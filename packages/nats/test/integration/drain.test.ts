import {afterAll, beforeAll, describe, expect, test} from 'bun:test'
import {Application} from 'lakutata'
import {BuildEntrypoints, Controller} from 'lakutata/com/entrypoint'
import {ServiceAction} from 'lakutata/decorator/ctrl'
import {Delay} from 'lakutata/helper'
import {
    buildNatsClientOptions,
    BuildServiceProxy,
    ServiceProxy,
    SetupNatsServiceEntrypoint
} from '../../src/CommonExports'
import {destroyApp, runApp} from '../helpers/app'
import {ensureNats, stopNats} from '../helpers/shared-nats'

class SlowController extends Controller {
    @ServiceAction({cmd: 'slow'})
    public async slow(inp: {cmd: string; value: number}): Promise<{done: number}> {
        await Delay(250) // 模拟处理耗时
        return {done: inp.value}
    }
}

/**
 * 验证 #3 优雅停机:destroy() 用 drain() 而非 close()。
 * drain 会停止接新消息、把 in-flight 处理完、flush 出站再关闭;
 * 所以停机时正在处理的请求应正常完成,而不是像 close 那样被硬切断。
 */
describe('优雅停机 drain', (): void => {
    let natsUrl: string

    beforeAll(async (): Promise<void> => {
        natsUrl = (await ensureNats()).url
    }, 120000)

    afterAll(async (): Promise<void> => {
        await stopNats()
    }, 60000)

    test('destroy(drain) 期间 in-flight 请求能正常完成,不被切断', async (): Promise<void> => {
        const app: Application = await runApp({
            id: 'it.drain.app',
            name: 'ITDrain',
            components: {
                nats: buildNatsClientOptions({servers: natsUrl}),
                entrypoint: BuildEntrypoints({
                    controllers: [SlowController],
                    service: SetupNatsServiceEntrypoint('nats')
                })
            },
            providers: {
                self: BuildServiceProxy({serviceId: 'it.drain.app', natsComponentName: 'nats'})
            },
            bootstrap: ['entrypoint']
        })
        const self: ServiceProxy = await app.getObject<ServiceProxy>('self')

        // 发起慢请求(不 await),让它进入"处理中"
        const inflight: Promise<any> = self.invoke({cmd: 'slow', value: 42}, 10000)
        await Delay(60) // 确保 handler 已开始处理(还在 250ms 的 delay 中)

        // 触发优雅停机:drain 应等 in-flight 处理完、响应回传,而不是立即切断
        const stopping: Promise<void> = destroyApp(app)

        // 若是 close 会切断 → 超时/失败;drain 应让它拿到正常结果
        expect(await inflight).toEqual({done: 42})

        await stopping
    })
})
