import {afterAll, beforeAll, describe, expect, test} from 'bun:test'
import {Application} from 'lakutata'
import {Delay} from 'lakutata/helper'
import {buildNatsClientOptions, JSONCodec, NATS} from '../../src/CommonExports'
import {destroyApp, runApp} from '../helpers/app'
import {ensureNats, stopNats} from '../helpers/shared-nats'

/**
 * 传输层:显式 codec 选择、queue 负载均衡、subscribe 的 iterator 模式。
 * 一个 app 注册三条连接:nats(默认 MessagePack)、natsJson(显式 JSON)、nats2(默认,做 queue 第二消费者)。
 */
describe('transport: codec / queue / subscribe', (): void => {
    let app: Application
    let nats: NATS
    let natsJson: NATS
    let nats2: NATS

    beforeAll(async (): Promise<void> => {
        const n = await ensureNats()
        app = await runApp({
            id: 'it.transport.app',
            name: 'ITTransport',
            components: {
                nats: buildNatsClientOptions({servers: n.url}),
                natsJson: buildNatsClientOptions({servers: n.url, codec: JSONCodec()}),
                nats2: buildNatsClientOptions({servers: n.url})
            }
        })
        nats = await app.getObject<NATS>('nats')
        natsJson = await app.getObject<NATS>('natsJson')
        nats2 = await app.getObject<NATS>('nats2')
    }, 120000)

    afterAll(async (): Promise<void> => {
        if (app) await destroyApp(app)
        await stopNats()
    }, 60000)

    test('显式 JSONCodec:publish / subscribe 往返', async (): Promise<void> => {
        const got: Promise<any> = new Promise<any>((resolve): void => {
            natsJson.subscribe('json.subject', (data: any): null => {
                resolve(data)
                return null
            })
        })
        await Delay(120)
        natsJson.publish('json.subject', {via: 'json', n: 7, nested: {ok: true}})
        expect(await got).toEqual({via: 'json', n: 7, nested: {ok: true}})
    })

    test('queue 负载均衡:同 queue 两个订阅者,一次 publish 只一个收到', async (): Promise<void> => {
        let c1: number = 0
        let c2: number = 0
        nats.subscribe('q.subject', (): null => {
            c1++
            return null
        }, {queue: 'qgroup'})
        nats2.subscribe('q.subject', (): null => {
            c2++
            return null
        }, {queue: 'qgroup'})
        await Delay(180)
        nats.publish('q.subject', {x: 1})
        await Delay(300)
        expect(c1 + c2).toBe(1)
    })

    test('subscribe iterator 模式:收到并解码消息', async (): Promise<void> => {
        const got: Promise<any> = new Promise<any>((resolve): void => {
            nats.subscribe('iter.subject', (data: any): null => {
                resolve(data)
                return null
            }, {iterator: true})
        })
        await Delay(120)
        nats.publish('iter.subject', {mode: 'iterator'})
        expect(await got).toEqual({mode: 'iterator'})
    })
})
