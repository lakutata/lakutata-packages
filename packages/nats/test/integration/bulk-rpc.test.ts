import {afterAll, beforeAll, describe, expect, test} from 'bun:test'
import {Application} from 'lakutata'
import {BuildEntrypoints, Controller} from 'lakutata/com/entrypoint'
import {ServiceAction} from 'lakutata/decorator/ctrl'
import {
    buildNatsClientOptions,
    BuildServiceProxy,
    NatsBulkException,
    ServiceInvokeException,
    ServiceProxy,
    SetupNatsServiceEntrypoint
} from '../../src/CommonExports'
import {destroyApp, runApp} from '../helpers/app'
import {ensureNats, stopNats} from '../helpers/shared-nats'

// 1.5MB:大于 max_payload(默认 1MB),所以"能成功传输"就证明走了 Object Store 而非直传
const BIG = 1.5 * 1024 * 1024

class BulkController extends Controller {
    @ServiceAction({cmd: 'echo'})
    public async echo(inp: {cmd: string; value: number}): Promise<{echoed: number}> {
        return {echoed: inp.value}
    }

    @ServiceAction({cmd: 'bigResponse'})
    public async bigResponse(inp: {cmd: string; size: number}): Promise<{data: string}> {
        return {data: 'x'.repeat(inp.size)}
    }

    @ServiceAction({cmd: 'bigEcho'})
    public async bigEcho(inp: {cmd: string; data: string}): Promise<{len: number}> {
        return {len: inp.data.length}
    }
}

/**
 * S2:RPC 大数据透明走 Object Store 中转 + 双向能力协商 + 退化。
 * 数据 > max_payload,所以"成功传输"即证明走了 Object Store(直传会被 NATS 拒绝)。
 */
describe('S2 RPC 大数据中转', (): void => {
    let app: Application
    let self: ServiceProxy
    let legacy: ServiceProxy
    let mismatch: ServiceProxy

    beforeAll(async (): Promise<void> => {
        const n = await ensureNats()
        app = await runApp({
            id: 'it.bulkrpc.app',
            name: 'ITBulkRpc',
            components: {
                nats: buildNatsClientOptions({servers: n.url}), // bulk 默认 true(服务端 + self 客户端)
                natsLegacy: buildNatsClientOptions({servers: n.url, bulk: false}), // 模拟不支持 bulk 的客户端
                // 用不同 bucket:服务端把大响应 put 进自己的 bucket,此客户端从自己的 bucket 取不到 → 模拟"引用取不到"
                natsMismatch: buildNatsClientOptions({servers: n.url, bulkBucket: 'mismatch-bucket'}),
                entrypoint: BuildEntrypoints({
                    controllers: [BulkController],
                    service: SetupNatsServiceEntrypoint('nats')
                })
            },
            providers: {
                self: BuildServiceProxy({serviceId: 'it.bulkrpc.app', natsComponentName: 'nats'}),
                legacy: BuildServiceProxy({serviceId: 'it.bulkrpc.app', natsComponentName: 'natsLegacy'}),
                mismatch: BuildServiceProxy({serviceId: 'it.bulkrpc.app', natsComponentName: 'natsMismatch'})
            },
            bootstrap: ['entrypoint']
        })
        self = await app.getObject<ServiceProxy>('self')
        legacy = await app.getObject<ServiceProxy>('legacy')
        mismatch = await app.getObject<ServiceProxy>('mismatch')
    }, 120000)

    afterAll(async (): Promise<void> => {
        if (app) await destroyApp(app)
        await stopNats()
    }, 60000)

    test('响应侧大数据:invoke 拿到完整 1.5MB 响应(>max_payload,证明走了 Object Store)', async (): Promise<void> => {
        const result: any = await self.invoke({cmd: 'bigResponse', size: BIG}, 30000)
        expect(result.data.length).toBe(BIG) // 完整拿到,API 无感
    })

    test('请求侧大数据:预热缓存后,发 1.5MB 请求,服务端完整收到', async (): Promise<void> => {
        // 先发个小请求预热"对端能力"缓存(请求侧才能用引用)
        await self.invoke({cmd: 'echo', value: 1}, 5000)
        const result: any = await self.invoke({cmd: 'bigEcho', data: 'x'.repeat(BIG)}, 30000)
        expect(result.len).toBe(BIG) // 服务端收到完整大请求
    })

    test('退化:不支持 bulk 的客户端(不声明能力)→ 服务端直传大响应 → 超 max_payload 失败', async (): Promise<void> => {
        let caught: any
        try {
            await legacy.invoke({cmd: 'bigResponse', size: BIG}, 30000)
        } catch (e) {
            caught = e
        }
        // legacy 不声明 → 服务端不走引用 → 直传 1.5MB 超 max_payload → 回错误响应
        expect(caught).toBeInstanceOf(ServiceInvokeException)
    })

    test('小消息透明:走原路,不进 Object Store', async (): Promise<void> => {
        expect(await self.invoke({cmd: 'echo', value: 42}, 5000)).toEqual({echoed: 42})
    })

    test('错误传播:响应引用取不到(不同 bucket)→ 客户端抛 NatsBulkException(不静默、不误重试)', async (): Promise<void> => {
        // 服务端把大响应 put 进自己的 bucket,mismatch 从自己的 bucket 取不到引用
        let caught: any
        try {
            await mismatch.invoke({cmd: 'bigResponse', size: BIG}, 30000)
        } catch (e) {
            caught = e
        }
        expect(caught).toBeInstanceOf(NatsBulkException)
    })
})
