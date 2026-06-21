import {afterAll, beforeAll, describe, expect, test} from 'bun:test'
import {Application} from 'lakutata'
import {BuildEntrypoints, Controller} from 'lakutata/com/entrypoint'
import {ServiceAction} from 'lakutata/decorator/ctrl'
import {connect, NatsConnection} from 'nats'
import {
    buildNatsClientOptions,
    BuildServiceProxy,
    MessagePackCodec,
    ServiceProxy,
    SetupNatsServiceEntrypoint
} from '../../src/CommonExports'
import {destroyApp, runApp} from '../helpers/app'
import {ensureNats, stopNats} from '../helpers/shared-nats'

const codec = MessagePackCodec()

class EchoController extends Controller {
    @ServiceAction({cmd: 'echo'})
    public async echo(inp: {cmd: string; value: number}): Promise<{echoed: number}> {
        return {echoed: inp.value}
    }
}

// 模拟"旧版客户端"的 invoke:裸 NATS,不带任何 header,payload 直传,响应按 ServiceResponse 直解。
async function legacyInvoke(conn: NatsConnection, serviceId: string, pattern: any): Promise<any> {
    const response = await conn.request(serviceId, codec.encode(pattern), {timeout: 5000})
    const sr: any = codec.decode(response.data)
    if (!sr.success) throw new Error(sr.error?.message ?? 'service error')
    return sr.payload
}

/**
 * 真正的新老版本兼容(wire 层):用裸 NATS 模拟"S2 之前的旧版"(无 header、无中转),
 * 和新版组件互通,验证两个方向都不破坏。
 */
describe('新老版本兼容(裸 NATS 模拟真旧版)', (): void => {
    let app: Application
    let selfToLegacy: ServiceProxy
    let bareConn: NatsConnection // 裸连接,扮演旧版

    beforeAll(async (): Promise<void> => {
        const n = await ensureNats()
        app = await runApp({
            id: 'it.compat.app',
            name: 'ITCompat',
            components: {
                nats: buildNatsClientOptions({servers: n.url}), // 新版(bulk 默认 true)
                entrypoint: BuildEntrypoints({
                    controllers: [EchoController],
                    service: SetupNatsServiceEntrypoint('nats') // 新版服务端,serviceId = appId
                })
            },
            providers: {
                // 新版客户端,指向"旧版服务端"(下面裸 subscribe 的 legacy.svc)
                selfToLegacy: BuildServiceProxy({serviceId: 'legacy.svc', natsComponentName: 'nats'})
            },
            bootstrap: ['entrypoint']
        })
        selfToLegacy = await app.getObject<ServiceProxy>('selfToLegacy')

        // 裸连接 = 旧版。它再开一个"旧版服务端":subscribe legacy.svc,不读 header、直传响应。
        bareConn = await connect({servers: n.url})
        bareConn.subscribe('legacy.svc', {
            callback: (err, msg): void => {
                if (err || !msg.reply) return
                const pattern: any = codec.decode(msg.data) // 旧版:直接 decode,不看 header
                const result = {echoed: pattern.value}
                // 旧版:回 ServiceResponse 格式,不带任何 header
                msg.respond(codec.encode({success: true, error: null, payload: result}))
            }
        })
    }, 120000)

    afterAll(async (): Promise<void> => {
        try {
            await bareConn?.drain()
        } catch {
            // 忽略
        }
        if (app) await destroyApp(app)
        await stopNats()
    }, 60000)

    test('旧客户端 → 新服务端:旧版不带 header,新服务端正确处理并直传响应', async (): Promise<void> => {
        const result = await legacyInvoke(bareConn, 'it.compat.app', {cmd: 'echo', value: 7})
        expect(result).toEqual({echoed: 7})
    })

    test('新客户端 → 旧服务端:旧服务端不声明能力,新客户端学到后退化直传,正常拿到结果', async (): Promise<void> => {
        const result = await selfToLegacy.invoke({cmd: 'echo', value: 8}, 5000)
        expect(result).toEqual({echoed: 8})
    })
})
