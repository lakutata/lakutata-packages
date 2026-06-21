import {afterAll, beforeAll, describe, expect, test} from 'bun:test'
import {Application} from 'lakutata'
import {BuildEntrypoints, Controller} from 'lakutata/com/entrypoint'
import {ServiceAction} from 'lakutata/decorator/ctrl'
import {Delay} from 'lakutata/helper'
import {
    buildNatsClientOptions,
    BuildServiceProxy,
    NATS,
    ServiceProxy,
    SetupNatsServiceEntrypoint
} from '../../src/CommonExports'
import {destroyApp, runApp} from '../helpers/app'
import {ensureNats, stopNats} from '../helpers/shared-nats'

/**
 * Phase 0 冒烟测试:验证 bun × testcontainers × lakutata 三者打通。
 * 覆盖两条最关键的链路:NATS 组件收发 + 服务层 RPC(装饰器 + DI + entrypoint + ServiceProxy)。
 *
 * 注意:lakutata 一个进程只能存在一个 Application(全局 @runtime alias),
 * 所以这里用「单 app fixture」—— 一个 app 内注册全部所需对象,各 test 复用。
 */
class EchoController extends Controller {
    @ServiceAction({cmd: 'echo'})
    public async echo(inp: {cmd: string; value: number}): Promise<{echoed: number}> {
        return {echoed: inp.value}
    }
}

describe('Phase 0 smoke', (): void => {
    let app: Application

    beforeAll(async (): Promise<void> => {
        await ensureNats()
        app = await runApp({
            id: 'smoke.app',
            name: 'Smoke',
            components: {
                nats: buildNatsClientOptions({servers: process.env.NATS_URL!}),
                entrypoint: BuildEntrypoints({
                    controllers: [EchoController],
                    service: SetupNatsServiceEntrypoint('nats')
                })
            },
            providers: {
                self: BuildServiceProxy({serviceId: 'smoke.app', natsComponentName: 'nats'})
            },
            bootstrap: ['entrypoint']
        })
    }, 120000)

    afterAll(async (): Promise<void> => {
        if (app) await destroyApp(app)
        await stopNats()
    }, 60000)

    test('NATS 组件:publish / subscribe 往返', async (): Promise<void> => {
        const nats: NATS = await app.getObject<NATS>('nats')
        const received: Promise<any> = new Promise<any>((resolve): void => {
            nats.subscribe('smoke.subject', (data: any): null => {
                resolve(data)
                return null
            })
        })
        await Delay(100) // 给订阅建立留出时间
        nats.publish('smoke.subject', {hello: 'bun'})
        expect(await received).toEqual({hello: 'bun'})
    })

    test('服务层 RPC:@ServiceAction + ServiceProxy.invoke 往返', async (): Promise<void> => {
        const proxy: ServiceProxy = await app.getObject<ServiceProxy>('self')
        const result: any = await proxy.invoke({cmd: 'echo', value: 42}, 5000)
        expect(result).toEqual({echoed: 42})
    })
})
