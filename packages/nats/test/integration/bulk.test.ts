import {afterAll, beforeAll, describe, expect, test} from 'bun:test'
import {Application} from 'lakutata'
import {buildNatsClientOptions, NATS, NatsBulkException} from '../../src/CommonExports'
import {millis, StorageType} from 'nats'
import {destroyApp, runApp} from '../helpers/app'
import {ensureNats, stopNats} from '../helpers/shared-nats'

/**
 * S1:验证 NATS 组件的 bulk 基础能力(独立连接 + Object Store + 阈值/header 探针)。
 * 不涉及任何中转/服务层逻辑,纯基础设施。
 */
describe('S1 bulk 基础能力', (): void => {
    let app: Application
    let nats: NATS
    let natsNoBulk: NATS
    let natsDefaults: NATS

    beforeAll(async (): Promise<void> => {
        const n = await ensureNats()
        app = await runApp({
            id: 'it.bulk.app',
            name: 'ITBulk',
            components: {
                nats: buildNatsClientOptions({servers: n.url, bulk: true, bulkBucket: 'test-bulk', bulkTTL: 60000}),
                natsNoBulk: buildNatsClientOptions({servers: n.url, bulk: false}),
                // 不传任何 bulk* 配置(name 唯一以免 bucket 名撞车)→ 验证默认值
                natsDefaults: buildNatsClientOptions({servers: n.url, name: 'defaults'})
            }
        })
        nats = await app.getObject<NATS>('nats')
        natsNoBulk = await app.getObject<NATS>('natsNoBulk')
        natsDefaults = await app.getObject<NATS>('natsDefaults')
    }, 120000)

    afterAll(async (): Promise<void> => {
        if (app) await destroyApp(app)
        await stopNats()
    }, 60000)

    test('bulkEnabled 反映配置', (): void => {
        expect(nats.bulkEnabled).toBe(true)
        expect(natsNoBulk.bulkEnabled).toBe(false)
    })

    test('bulkThreshold = max_payload × 0.9(从连接 info 自动读)', (): void => {
        // NATS 默认 max_payload 1MB → 阈值 = floor(1MB × 0.9)
        expect(nats.bulkThreshold).toBe(Math.floor(1024 * 1024 * 0.9))
    })

    test('headersSupported(NATS 2.x server 支持 header)', (): void => {
        expect(nats.headersSupported).toBe(true)
    })

    test('putBulk / getBulk 往返字节一致', async (): Promise<void> => {
        const bytes = new Uint8Array([1, 2, 3, 4, 5, 255, 0, 128])
        const objId: string = await nats.putBulk(bytes)
        expect(typeof objId).toBe('string')
        const got: Uint8Array = await nats.getBulk(objId)
        expect(Array.from(got)).toEqual([1, 2, 3, 4, 5, 255, 0, 128])
    })

    test('deleteBulk 后对象不存在', async (): Promise<void> => {
        const objId: string = await nats.putBulk(new Uint8Array([9, 9, 9]))
        await nats.deleteBulk(objId)
        let caught: any
        try {
            await nats.getBulk(objId)
        } catch (e) {
            caught = e
        }
        expect(caught).toBeInstanceOf(NatsBulkException) // 已删除 → not found,语义化为 NatsBulkException
    })

    test('未启用 bulk 时 putBulk 抛 NatsBulkException', async (): Promise<void> => {
        let caught: any
        try {
            await natsNoBulk.putBulk(new Uint8Array([1]))
        } catch (e) {
            caught = e
        }
        expect(caught).toBeInstanceOf(NatsBulkException)
    })

    test('默认配置:bulk=true / bucket=lkt-bulk-${name} / ttl=5min / replicas=1 / File 存储', async (): Promise<void> => {
        expect(natsDefaults.bulkEnabled).toBe(true) // bulk 默认 true
        const status = await natsDefaults.bulkStatus()
        expect(status).toBeDefined()
        expect(status!.bucket).toBe('lkt-bulk-defaults')  // 默认 bucket 名 = lkt-bulk-${name}
        expect(millis(status!.ttl)).toBe(5 * 60 * 1000)   // 默认 TTL 5 分钟
        expect(status!.replicas).toBe(1)                  // 默认 replicas 1
        expect(status!.storage).toBe(StorageType.File)    // File 存储
    })
})
