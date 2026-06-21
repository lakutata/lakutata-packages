import {afterAll, beforeAll, describe, expect, test} from 'bun:test'
import {Application} from 'lakutata'
import {BuildEntrypoints, Controller} from 'lakutata/com/entrypoint'
import {ServiceAction} from 'lakutata/decorator/ctrl'
import {Delay} from 'lakutata/helper'
import {
    buildNatsClientOptions,
    BuildServiceProxy,
    NatsNoRespondersAvailableException,
    NatsRequestTimeoutException,
    ServiceInvokeException,
    ServiceProxy,
    SetupNatsServiceEntrypoint
} from '../../src/CommonExports'
import {destroyApp, runApp} from '../helpers/app'
import {ensureNats, stopNats} from '../helpers/shared-nats'

class RetryController extends Controller {
    @ServiceAction({cmd: 'ok'})
    public async ok(): Promise<{ok: boolean}> {
        return {ok: true}
    }

    @ServiceAction({cmd: 'slow'})
    public async slow(): Promise<{ok: boolean}> {
        await Delay(1000)
        return {ok: true}
    }

    @ServiceAction({cmd: 'boom'})
    public async boom(): Promise<never> {
        throw new Error('boom error')
    }
}

/**
 * 验证 #7 自动重试的安全边界:
 *   - 只对 NoResponders(对侧确定没处理)重试;
 *   - 超时(可能已处理但响应丢失)、业务异常(对侧已处理并返回)一律不重试,直接抛。
 */
describe('#7 NoResponders 安全重试', (): void => {
    let app: Application
    let self: ServiceProxy
    let dead: ServiceProxy
    let deadDefault: ServiceProxy

    beforeAll(async (): Promise<void> => {
        const n = await ensureNats()
        app = await runApp({
            id: 'it.retry.app',
            name: 'ITRetry',
            components: {
                nats: buildNatsClientOptions({servers: n.url}),
                entrypoint: BuildEntrypoints({
                    controllers: [RetryController],
                    service: SetupNatsServiceEntrypoint('nats')
                })
            },
            providers: {
                self: BuildServiceProxy({serviceId: 'it.retry.app', natsComponentName: 'nats', maxRetries: 2, retryDelay: 50}),
                // 指向一个无人订阅的 serviceId → 必然 NoResponders
                dead: BuildServiceProxy({serviceId: 'nonexistent.service.xyz', natsComponentName: 'nats', maxRetries: 2, retryDelay: 50}),
                // 不传 maxRetries/retryDelay → 验证默认值(3 次 × 100ms)
                deadDefault: BuildServiceProxy({serviceId: 'nonexistent.service.xyz', natsComponentName: 'nats'})
            },
            bootstrap: ['entrypoint']
        })
        self = await app.getObject<ServiceProxy>('self')
        dead = await app.getObject<ServiceProxy>('dead')
        deadDefault = await app.getObject<ServiceProxy>('deadDefault')
    }, 120000)

    afterAll(async (): Promise<void> => {
        if (app) await destroyApp(app)
        await stopNats()
    }, 60000)

    test('NoResponders → 重试 maxRetries 次后才抛(耗时证明确实重试了)', async (): Promise<void> => {
        const t0: number = performance.now()
        let caught: any
        try {
            await dead.invoke({cmd: 'x'}, 3000)
        } catch (e) {
            caught = e
        }
        const elapsed: number = performance.now() - t0
        expect(caught).toBeInstanceOf(NatsNoRespondersAvailableException)
        expect(elapsed).toBeGreaterThanOrEqual(2 * 50 - 10) // 重试 2 次 × 50ms,留 margin
    })

    test('默认配置:不传 maxRetries/retryDelay 时,默认重试 3 次 × 100ms', async (): Promise<void> => {
        const t0: number = performance.now()
        let caught: any
        try {
            await deadDefault.invoke({cmd: 'x'}, 5000)
        } catch (e) {
            caught = e
        }
        const elapsed: number = performance.now() - t0
        expect(caught).toBeInstanceOf(NatsNoRespondersAvailableException)
        expect(elapsed).toBeGreaterThanOrEqual(3 * 100 - 20) // 默认 3 次 × 100ms,留 margin
    })

    test('超时 → 不重试(耗时≈单次 timeout,而非 maxRetries 倍)', async (): Promise<void> => {
        const t0: number = performance.now()
        let caught: any
        try {
            await self.invoke({cmd: 'slow'}, 200) // handler 要 1000ms,200ms 超时
        } catch (e) {
            caught = e
        }
        const elapsed: number = performance.now() - t0
        expect(caught).toBeInstanceOf(NatsRequestTimeoutException)
        expect(elapsed).toBeLessThan(600) // 只超时 1 次(~200ms);若重试 3 次会 ~600ms+
    })

    test('业务异常 → 不重试,直接抛 ServiceInvokeException', async (): Promise<void> => {
        let caught: any
        try {
            await self.invoke({cmd: 'boom'}, 3000)
        } catch (e) {
            caught = e
        }
        expect(caught).toBeInstanceOf(ServiceInvokeException)
    })

    test('正常请求 → 成功(重试机制不干扰正常路径)', async (): Promise<void> => {
        expect(await self.invoke({cmd: 'ok'}, 3000)).toEqual({ok: true})
    })
})
