import {Codec} from 'nats'

export interface NatsClientOptions {
    servers: string | string[]
    codec?: Codec<unknown>
    timeout?: number
    token?: string
    user?: string
    pass?: string
    debug?: boolean
    maxPingOut?: number
    maxReconnectAttempts?: number
    name?: string
    noEcho?: boolean
    noRandomize?: boolean
    pingInterval?: number
    reconnect?: boolean
    /** 是否启用 bulk 大数据旁路(启动建第二条连接 + Object Store),默认 true */
    bulk?: boolean
    /** bulk Object Store bucket 名,默认 lkt-bulk-${name} */
    bulkBucket?: string
    /** bulk 对象 TTL(毫秒),默认 5 分钟 */
    bulkTTL?: number
    /** bulk bucket 副本数,默认 1(中转数据用完即弃) */
    bulkReplicas?: number
}