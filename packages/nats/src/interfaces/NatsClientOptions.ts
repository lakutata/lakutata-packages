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
}