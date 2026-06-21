import {afterAll, beforeAll, describe, expect, test} from 'bun:test'
import {Application} from 'lakutata'
import {Delay} from 'lakutata/helper'
import {
    buildNatsClientOptions,
    NATS,
    NatsNoRespondersAvailableException,
    NatsRequestTimeoutException
} from '../../src/CommonExports'
import {destroyApp, runApp} from '../helpers/app'
import {ensureNats, stopNats} from '../helpers/shared-nats'

/**
 * 验证 NATS.request() 的错误码 → 异常映射。
 * 只有 503(无响应者)和 408(响应超时)能用真实 NATS 自然触发;
 * 400/403/404/500 在 core NATS 请求中不会自然产生,改由服务层异常往返 + 单元测试覆盖。
 */
describe('NATS.request 错误映射', (): void => {
    let app: Application
    let nats: NATS

    beforeAll(async (): Promise<void> => {
        const n = await ensureNats()
        app = await runApp({
            id: 'it.errors.app',
            name: 'ITErrors',
            components: {nats: buildNatsClientOptions({servers: n.url})}
        })
        nats = await app.getObject<NATS>('nats')
        // 一个永不响应的订阅,用于触发请求超时(408)
        nats.subscribe('slow.subject', (): Promise<any> => new Promise<any>((): void => {}))
        await Delay(150)
    }, 120000)

    afterAll(async (): Promise<void> => {
        if (app) await destroyApp(app)
        await stopNats()
    }, 60000)

    test('请求无人订阅的 subject → NatsNoRespondersAvailableException (503)', async (): Promise<void> => {
        let caught: any
        try {
            await nats.request('no.responder.subject.xyz', {ping: true}, 1000)
        } catch (e) {
            caught = e
        }
        expect(caught).toBeInstanceOf(NatsNoRespondersAvailableException)
    })

    // nats.js core 超时错误的 code 是 "TIMEOUT"(ErrorCode.Timeout),NATS.ts 已新增
    // case 'TIMEOUT' 将其映射为 NatsRequestTimeoutException。
    test('响应超时 → NatsRequestTimeoutException (408)', async (): Promise<void> => {
        let caught: any
        try {
            await nats.request('slow.subject', {ping: true}, 300)
        } catch (e) {
            caught = e
        }
        expect(caught).toBeInstanceOf(NatsRequestTimeoutException)
    })
})
