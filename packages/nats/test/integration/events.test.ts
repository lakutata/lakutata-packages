import {afterAll, beforeAll, describe, expect, test} from 'bun:test'
import {Application} from 'lakutata'
import {Delay} from 'lakutata/helper'
import {buildNatsClientOptions, NATS} from '../../src/CommonExports'
import {destroyApp, runApp} from '../helpers/app'
import {ensureNats, stopNats} from '../helpers/shared-nats'

/**
 * 验证 service event 总线:on / once / off / off-all / onlySingleClientReceived(queue 分发)。
 * 用同一个 app 内的两个 NATS 组件(两条连接)模拟多个客户端。
 */
describe('service events', (): void => {
    let app: Application
    let nats: NATS
    let nats2: NATS
    let serviceId: string

    beforeAll(async (): Promise<void> => {
        const n = await ensureNats()
        app = await runApp({
            id: 'it.events.app',
            name: 'ITEvents',
            components: {
                nats: buildNatsClientOptions({servers: n.url}),
                nats2: buildNatsClientOptions({servers: n.url})
            }
        })
        nats = await app.getObject<NATS>('nats')
        nats2 = await app.getObject<NATS>('nats2')
        serviceId = app.appId
    }, 120000)

    afterAll(async (): Promise<void> => {
        if (app) await destroyApp(app)
        await stopNats()
    }, 60000)

    test('on:emit 后 listener 收到全部参数', async (): Promise<void> => {
        const got: Promise<any[]> = new Promise<any[]>((resolve): void => {
            nats.onServiceEvent(serviceId, 'evtA', (a: any, b: any): void => resolve([a, b]))
        })
        await Delay(120)
        nats.emitServiceEvent('evtA', 1, 'x')
        expect(await got).toEqual([1, 'x'])
    })

    test('once:多次 emit 只触发一次', async (): Promise<void> => {
        let count: number = 0
        nats.onceServiceEvent(serviceId, 'evtOnce', (): void => {
            count++
        })
        await Delay(120)
        nats.emitServiceEvent('evtOnce')
        nats.emitServiceEvent('evtOnce')
        await Delay(250)
        expect(count).toBe(1)
    })

    test('off(listener):退订后不再收到', async (): Promise<void> => {
        let count: number = 0
        const listener = (): void => {
            count++
        }
        nats.onServiceEvent(serviceId, 'evtOff', listener)
        await Delay(120)
        nats.emitServiceEvent('evtOff')
        await Delay(150)
        nats.offServiceEvent(serviceId, 'evtOff', listener)
        await Delay(50)
        nats.emitServiceEvent('evtOff')
        await Delay(150)
        expect(count).toBe(1)
    })

    test('onlySingleClientReceived:两个 queue 订阅者只有一个收到', async (): Promise<void> => {
        let c1: number = 0
        let c2: number = 0
        nats.onServiceEvent(serviceId, 'evtQ', (): void => {
            c1++
        }, true)
        nats2.onServiceEvent(serviceId, 'evtQ', (): void => {
            c2++
        }, true)
        await Delay(180)
        nats.emitServiceEvent('evtQ')
        await Delay(300)
        expect(c1 + c2).toBe(1)
    })
})
