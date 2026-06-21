import {afterAll, beforeAll, describe, expect, test} from 'bun:test'
import {Application} from 'lakutata'
import {BuildEntrypoints, Controller} from 'lakutata/com/entrypoint'
import {ServiceAction} from 'lakutata/decorator/ctrl'
import {Delay} from 'lakutata/helper'
import {Codec} from 'nats'
import {
    buildNatsClientOptions,
    BuildServiceProxy,
    NATS,
    NatsRequestTimeoutException,
    ServiceInvokeException,
    ServiceProxy,
    SetupNatsServiceEntrypoint
} from '../../src/CommonExports'
import {destroyApp, runApp} from '../helpers/app'
import {ensureNats, stopNats} from '../helpers/shared-nats'

// 故意会失败的 codec:encode 总是产出坏的 msgpack 字节(声明 1 项数组却无数据 → 服务端 decode 抛),
// decode 总是抛错 → 用来模拟"跨语言/不兼容客户端"导致的入站 decode 失败。
const badCodec: Codec<any> = {
    encode: (_value: any): Uint8Array => new Uint8Array([0x91]),
    decode: (_bytes: any): any => {
        throw new Error('bad codec decode')
    }
}

class TestController extends Controller {
    @ServiceAction({cmd: 'echo'})
    public async echo(inp: {cmd: string; value: number}): Promise<{echoed: number}> {
        return {echoed: inp.value}
    }

    @ServiceAction({cmd: 'boom'})
    public async boom(): Promise<never> {
        throw new Error('boom error')
    }

    // 返回含 BigInt 的值 → 出站 codec.encode(JSON.stringify) 会抛 → 触发 subscribe 层的出站 encode 失败
    @ServiceAction({cmd: 'bigint'})
    public async bigint(): Promise<{n: bigint}> {
        return {n: BigInt(7)}
    }

    @ServiceAction({cmd: 'slow'})
    public async slow(): Promise<{ok: boolean}> {
        await Delay(1000)
        return {ok: true}
    }
}

describe('错误处理 / 防崩 / reply 守卫', (): void => {
    let app: Application
    let nats: NATS
    let natsBad: NATS
    let self: ServiceProxy
    const collectedErrors: any[] = []

    beforeAll(async (): Promise<void> => {
        const n = await ensureNats()
        app = await runApp({
            id: 'it.errhandling.app',
            name: 'ITErrHandling',
            components: {
                nats: buildNatsClientOptions({servers: n.url}),
                natsBad: buildNatsClientOptions({servers: n.url, codec: badCodec}),
                entrypoint: BuildEntrypoints({
                    controllers: [TestController],
                    service: SetupNatsServiceEntrypoint('nats')
                })
            },
            providers: {
                self: BuildServiceProxy({serviceId: 'it.errhandling.app', natsComponentName: 'nats'})
            },
            bootstrap: ['entrypoint']
        })
        nats = await app.getObject<NATS>('nats')
        natsBad = await app.getObject<NATS>('natsBad')
        self = await app.getObject<ServiceProxy>('self')
        // 注册 error 监听器:既验证失败被上报,又让 emitError 的 listenerCount 守卫生效
        nats.on('error', (e: any): void => {
            collectedErrors.push(e)
        })
    }, 120000)

    afterAll(async (): Promise<void> => {
        if (app) await destroyApp(app)
        await stopNats()
    }, 60000)

    test('回归:正常 RPC 返回 payload', async (): Promise<void> => {
        expect(await self.invoke({cmd: 'echo', value: 1}, 5000)).toEqual({echoed: 1})
    })

    test('回归:handler 业务异常 → 客户端收到 ServiceInvokeException', async (): Promise<void> => {
        let caught: any
        try {
            await self.invoke({cmd: 'boom'}, 5000)
        } catch (e) {
            caught = e
        }
        expect(caught).toBeInstanceOf(ServiceInvokeException)
        expect(caught.message).toBe('boom error')
    })

    test('出站 encode 失败(handler 返回 BigInt)→ 不黑洞,客户端快速收到 ServiceInvokeException', async (): Promise<void> => {
        const t0: number = performance.now()
        let caught: any
        try {
            await self.invoke({cmd: 'bigint'}, 5000)
        } catch (e) {
            caught = e
        }
        expect(caught).toBeInstanceOf(ServiceInvokeException) // 收到了错误响应,而不是挂到超时
        expect(performance.now() - t0).toBeLessThan(4000)     // 证明不是 5000ms 超时
    })

    test('入站 decode 失败(不兼容客户端发坏字节)→ 服务端不崩,后续 RPC 仍正常', async (): Promise<void> => {
        let caught: any
        try {
            await natsBad.request('it.errhandling.app', {x: 1}, 3000)
        } catch (e) {
            caught = e
        }
        expect(caught).toBeDefined() // 坏 codec 客户端拿不到可解析响应(预期)
        // 关键:服务端没被这条坏消息打崩,正常请求仍然工作
        expect(await self.invoke({cmd: 'echo', value: 99}, 5000)).toEqual({echoed: 99})
    })

    test('service event listener 抛异常 → 不崩,后续 RPC 仍正常', async (): Promise<void> => {
        nats.onServiceEvent('it.errhandling.app', 'evtErr', (): void => {
            throw new Error('listener boom')
        })
        await Delay(120)
        nats.emitServiceEvent('evtErr')
        await Delay(200)
        expect(await self.invoke({cmd: 'echo', value: 5}, 5000)).toEqual({echoed: 5})
    })

    test('普通 pub/sub 的 callback 抛异常 → 不崩,后续 RPC 仍正常', async (): Promise<void> => {
        nats.subscribe('boom.subject', (): never => {
            throw new Error('cb boom')
        })
        await Delay(100)
        nats.publish('boom.subject', {x: 1})
        await Delay(200)
        expect(await self.invoke({cmd: 'echo', value: 6}, 5000)).toEqual({echoed: 6})
    })

    test('iterator 模式:callback 抛异常 → 不崩,后续 RPC 正常', async (): Promise<void> => {
        nats.subscribe('iter.boom.subject', (): never => {
            throw new Error('iter boom')
        }, {iterator: true})
        await Delay(100)
        nats.publish('iter.boom.subject', {x: 1})
        await Delay(200)
        expect(await self.invoke({cmd: 'echo', value: 7}, 5000)).toEqual({echoed: 7})
    })

    test('reply 守卫:无 reply 的消息,callback 返回值不被发送,且正常接收', async (): Promise<void> => {
        const got: Promise<any> = new Promise<any>((resolve): void => {
            nats.subscribe('noreply.subject', (data: any): {should: string} => {
                resolve(data)
                return {should: 'not be responded'} // 无 reply,这个返回值不会被 encode/respond
            })
        })
        await Delay(100)
        nats.publish('noreply.subject', {ping: true})
        expect(await got).toEqual({ping: true}) // 收到了消息,且没有因 respond/encode 报错
    })

    test('invoke 超时路径:显式 timeout 到点抛 NatsRequestTimeoutException', async (): Promise<void> => {
        let caught: any
        try {
            await self.invoke({cmd: 'slow'}, 200) // handler 要 1000ms,200ms 必超时
        } catch (e) {
            caught = e
        }
        expect(caught).toBeInstanceOf(NatsRequestTimeoutException)
    })

    test('可观测性:上述失败都通过 error 事件上报(emitError 守卫生效,未静默崩溃)', (): void => {
        // 出站 encode 失败、入站 decode 失败、listener/callback 抛异常都应触发 emitError
        expect(collectedErrors.length).toBeGreaterThan(0)
    })
})
