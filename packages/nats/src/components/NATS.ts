import {
    Application,
    Component,
    ComponentOptions,
    ComponentOptionsBuilder,
    DTO
} from 'lakutata'
import {Configurable, Inject} from 'lakutata/decorator/di'
import {type Codec, connect, NatsConnection, Msg, Subscription, nanos, StorageType, type ObjectStore, type ObjectStoreStatus, headers, type MsgHdrs} from 'nats'
import {SubscribeOptions} from '../types/SubscribeOptions'
import {NatsBadRequestException} from '../exceptions/NatsBadRequestException'
import {NatsForbiddenException} from '../exceptions/NatsForbiddenException'
import {NatsNotFoundException} from '../exceptions/NatsNotFoundException'
import {NatsRequestTimeoutException} from '../exceptions/NatsRequestTimeoutException'
import {NatsNoRespondersAvailableException} from '../exceptions/NatsNoRespondersAvailableException'
import {NatsInternalServerException} from '../exceptions/NatsInternalServerException'
import {NatsBulkException} from '../exceptions/NatsBulkException'
import {NatsClientOptions} from '../interfaces/NatsClientOptions'
import {ServiceEventCodec, ServiceEventData} from '../lib/ServiceEventCodec'
import {MessagePackCodec} from '../codecs/MessagePackCodec'
import {randomUUID} from 'node:crypto'

// bulk 中转协议头(放 header,不污染 payload)
const HDR_BULK: string = 'X-Lkt-Bulk' // 能力声明:本端支持 bulk 引用中转
const HDR_REF: string = 'X-Lkt-Ref'   // 标记:payload 是 Object Store 引用 {__ref}

export const buildNatsClientOptions: ComponentOptionsBuilder<NatsClientOptions> = (options: NatsClientOptions): ComponentOptions<NatsClientOptions> => {
    return {
        class: NATS,
        servers: options.servers,
        codec: options.codec,
        timeout: options.timeout,
        token: options.token,
        user: options.user,
        pass: options.pass,
        debug: options.debug,
        maxPingOut: options.maxPingOut,
        maxReconnectAttempts: options.maxReconnectAttempts,
        name: options.name,
        noEcho: options.noEcho,
        noRandomize: options.noRandomize,
        pingInterval: options.pingInterval,
        reconnect: options.reconnect,
        bulk: options.bulk,
        bulkBucket: options.bulkBucket,
        bulkTTL: options.bulkTTL,
        bulkReplicas: options.bulkReplicas
    }
}

export class NATS extends Component {
    /**
     * Application instance
     * @protected
     */
    @Inject(Application)
    protected readonly app: Application

    /**
     * NATS servers
     * @protected
     */
    @Configurable(DTO.Alternatives(DTO.String(), DTO.Array(DTO.String())).required())
    protected readonly servers: string | string[]

    /**
     * NATS message codec
     * @protected
     */
    @Configurable(DTO.Object({
        encode: DTO.Function().arity(1).required(),
        decode: DTO.Function().arity(1).required()
    }).optional().default(MessagePackCodec()))
    protected readonly codec: Codec<unknown>

    /**
     * Sets the number of milliseconds the client should wait for a server
     * handshake to be established
     * @protected
     */
    @Configurable(DTO.Number().integer().optional())
    protected readonly timeout?: number

    /**
     * Set to a client authentication token. Note that these tokens are
     * a specific authentication strategy on the nats-server
     * @protected
     */
    @Configurable(DTO.String().optional())
    protected readonly token?: string

    /**
     * Sets the username for a client connection
     * @protected
     */
    @Configurable(DTO.String().optional())
    protected readonly user?: string

    /**
     * Sets the password for a client connection
     * @protected
     */
    @Configurable(DTO.String().optional())
    protected readonly pass?: string

    /**
     * When set to `true` the client will print protocol messages that it receives
     * or sends to the server
     * @protected
     */
    @Configurable(DTO.Boolean().optional())
    protected readonly debug?: boolean

    /**
     * Sets the maximum count of ping commands that can be awaiting a response
     * before rasing a stale connection status notification and initiating a reconnect
     * @protected
     */
    @Configurable(DTO.Number().optional())
    protected readonly maxPingOut?: number

    /**
     * Sets the maximum count of per-server reconnect attempts before giving up.
     * Set to `-1` to never give up
     *
     * @default 10
     * @protected
     */
    @Configurable(DTO.Number().optional().default(10))
    protected readonly maxReconnectAttempts?: number

    /**
     * Sets the client name. When set, the server monitoring pages will display
     * this name when referring to this client
     * @protected
     */
    @Configurable(DTO.String().optional())
    protected readonly name?: string

    /**
     * When set to true, messages published by this client will not match
     * this client's subscriptions, so the client is guaranteed to never
     * receive self-published messages on a subject that it is listening on
     * @protected
     */
    @Configurable(DTO.Boolean().optional())
    protected readonly noEcho?: boolean

    /**
     * If set to true, the client will not randomize its server connection list
     * @protected
     */
    @Configurable(DTO.Boolean().optional())
    protected readonly noRandomize?: boolean

    /**
     * Sets the number of milliseconds between client initiated ping commands
     *
     * @default 2 minutes.
     * @protected
     */
    @Configurable(DTO.Number().optional().default(1000 * 60 * 2))
    protected readonly pingInterval?: number

    /**
     * When set to true, the server will attempt to reconnect so long as doesn't prevent it
     *
     * @default true
     * @protected
     */
    @Configurable(DTO.Boolean().optional().default(true))
    protected readonly reconnect?: boolean

    /**
     * 是否启用 bulk 大数据旁路:启用后启动时建第二条独立连接 + 准备 Object Store。
     * @default true
     * @protected
     */
    @Configurable(DTO.Boolean().optional().default(true))
    protected readonly bulk?: boolean

    /**
     * bulk Object Store bucket 名,默认 lkt-bulk-${name}。
     * @protected
     */
    @Configurable(DTO.String().optional())
    protected readonly bulkBucket?: string

    /**
     * bulk 对象 TTL(毫秒),默认 5 分钟。
     * @protected
     */
    @Configurable(DTO.Number().integer().optional().default(5 * 60 * 1000))
    protected readonly bulkTTL?: number

    /**
     * bulk bucket 副本数,默认 1(中转数据用完即弃,不需要高可用副本)。
     * @protected
     */
    @Configurable(DTO.Number().integer().optional().default(1))
    protected readonly bulkReplicas?: number

    /**
     * Service event subscription map
     * @protected
     */
    protected readonly serviceEventSubscriptionMap: Map<string, Map<(...args: any[]) => void, Subscription>> = new Map()

    /**
     * NATS client instance
     * @private
     */
    #conn: NatsConnection

    /**
     * bulk 连接与 Object Store(仅 bulk 启用时存在)
     * @private
     */
    #bulkConn?: NatsConnection

    #objectStore?: ObjectStore

    /**
     * 缓存对端(按 subject)是否支持 bulk 中转,从对方响应/请求的能力声明 header 学到。
     * 用于请求侧判断对端:已知支持才发引用,未知/不支持则直传(向后兼容)。
     * @private
     */
    readonly #peerCapabilityCache: Map<string, boolean> = new Map()

    /**
     * Initializer
     * @protected
     */
    protected async init(): Promise<void> {
        const connectOptions = {
            servers: this.servers,
            user: this.user,
            pass: this.pass,
            timeout: this.timeout,
            token: this.token,
            debug: this.debug,
            maxPingOut: this.maxPingOut,
            maxReconnectAttempts: this.maxReconnectAttempts,
            name: this.name,
            noEcho: this.noEcho,
            noRandomize: this.noRandomize,
            pingInterval: this.pingInterval,
            reconnect: this.reconnect
        }
        this.#conn = await connect(connectOptions)
        if (this.bulk) {
            // 用同一套配置再开一条【独立】连接专供大数据,避免大对象传输堵塞 core RPC 连接;
            // 并 get-or-create 一个 Object Store bucket 做大对象中转(短 TTL 自动清理)。
            this.#bulkConn = await connect({
                ...connectOptions,
                name: this.name ? `${this.name}-bulk` : undefined
            })
            const bucket: string = this.bulkBucket ?? `lkt-bulk-${this.name ?? 'default'}`
            // 仅在用户【显式】配置了 bulkReplicas 时才下发 replicas;默认(undefined)不发该字段,
            // 让 server 用默认单副本。无条件发 replicas 在部分 nats.js / NATS server 组合下会被
            // 拒绝(invalid json: unknown field "replicas"),且默认值 1 显式下发本就没有收益。
            const osOptions: Record<string, any> = {
                storage: StorageType.File,
                ttl: nanos(this.bulkTTL ?? 5 * 60 * 1000)
            }
            if (this.bulkReplicas !== undefined) osOptions.replicas = this.bulkReplicas
            this.#objectStore = await this.#bulkConn.jetstream().views.os(bucket, osOptions)
        }
    }

    /**
     * Destroyer
     * @protected
     */
    protected async destroy(): Promise<void> {
        await this.drainConnection(this.#conn)
        if (this.#bulkConn) await this.drainConnection(this.#bulkConn)
    }

    /**
     * 优雅停机:drain 停止接收新消息、把 in-flight 处理完、flush 出站后再关闭,
     * 这样 K8s 滚动升级/缩容时正在处理的请求不被硬切断;drain 失败兜底强制关闭。
     * @param conn
     * @private
     */
    private async drainConnection(conn: NatsConnection): Promise<void> {
        try {
            await conn.drain()
        } catch {
            try {
                await conn.close()
            } catch {
                // 连接已不可用,忽略
            }
        }
    }

    /**
     * Publishes the specified data to the specified subject.
     * @param subject
     * @param payload
     */
    public publish(subject: string, payload: any): void {
        return this.#conn.publish(subject, this.codec.encode(payload))
    }

    /**
     * Publishes a request with specified data in the specified subject expecting a
     * response before timeout milliseconds. The api returns a
     * Promise that resolves when the first response to the request is received. If
     * there are no responders (a subscription) listening on the request subject,
     * the request will fail as soon as the server processes it
     * @param subject
     * @param payload
     * @param timeout
     */
    public async request(subject: string, payload?: any, timeout?: number): Promise<any> {
        const reqHeaders: MsgHdrs = headers()
        if (this.bulkEnabled) reqHeaders.set(HDR_BULK, '1') // 仅本端启用 bulk 时声明能力
        const peerSupports: boolean = this.#peerCapabilityCache.get(subject) === true
        const packed = await this.packPayload(payload, peerSupports)
        if (packed.isRef) reqHeaders.set(HDR_REF, '1')
        try {
            const response: Msg = await this.#conn.request(subject, packed.bytes, {timeout: timeout ? timeout : 0, headers: reqHeaders})
            // 双向协商:从响应学习对端是否支持中转
            this.#peerCapabilityCache.set(subject, response.headers?.get(HDR_BULK) === '1')
            // 还原响应(可能是 Object Store 引用)
            return await this.unpackPayload(response.data, response.headers?.get(HDR_REF) === '1')
        } catch (e: any) {
            if (e.code) {
                switch (e.code.toString()) {
                    case '400':
                        throw new NatsBadRequestException()
                    case '403':
                        throw new NatsForbiddenException()
                    case '404':
                        throw new NatsNotFoundException()
                    case '408':
                    case 'TIMEOUT':
                        throw new NatsRequestTimeoutException()
                    case '503':
                        throw new NatsNoRespondersAvailableException()
                    case '500':
                        throw new NatsInternalServerException()
                    default:
                        throw e
                }
            } else {
                throw e
            }
        } finally {
            // 请求引用对象:服务端已取回(响应已返回),删除;失败靠 TTL 兜底
            if (packed.objId) this.deleteBulk(packed.objId).catch((): void => undefined)
        }
    }

    /**
     * Subscribe expresses interest in the specified subject. The subject may
     * have wildcards. Messages are delivered to the callback.
     * If the subscription receives request, the callback return's value will respond to requester
     * @param subject
     * @param callback
     * @param subscribeOptions
     */
    public subscribe(subject: string, callback: (data: any) => any | Promise<any>, subscribeOptions?: SubscribeOptions): Subscription {
        const subscription: Subscription = this.#conn.subscribe(subject, {
            queue: subscribeOptions?.queue,
            max: subscribeOptions?.max
        })
        const handleMessage = async (msg: Msg): Promise<void> => {
            try {
                // 入站:若标记为引用,从 Object Store 取回真实 payload(对小消息/event 透明)
                const data: any = await this.unpackPayload(msg.data, msg.headers?.get(HDR_REF) === '1')
                const result: any = await callback(data)
                // 仅当消息是请求(带 reply)时才回响应;publish/event 无 reply,跳过。
                if (msg.reply) {
                    const respHeaders: MsgHdrs = headers()
                    if (this.bulkEnabled) respHeaders.set(HDR_BULK, '1') // 仅本端启用 bulk 时声明能力
                    // 请求方是否支持中转 → 决定大响应能否走引用
                    const clientSupports: boolean = msg.headers?.get(HDR_BULK) === '1'
                    const packed = await this.packPayload(result, clientSupports)
                    if (packed.isRef) respHeaders.set(HDR_REF, '1')
                    msg.respond(packed.bytes, {headers: respHeaders})
                }
            } catch (e: any) {
                this.emitError(e)
                // 若是请求且上层提供了错误响应工厂,回标准失败响应(直传 + 能力声明),避免请求方挂到超时。
                if (msg.reply && subscribeOptions?.errorResponse) {
                    try {
                        const errHeaders: MsgHdrs = headers()
                        if (this.bulkEnabled) errHeaders.set(HDR_BULK, '1')
                        const errorPayload: any = subscribeOptions.errorResponse(e)
                        if (errorPayload !== undefined) msg.respond(this.codec.encode(errorPayload), {headers: errHeaders})
                    } catch (encodeError: any) {
                        this.emitError(encodeError)
                    }
                }
            }
        }
        if (subscribeOptions?.iterator) {
            setImmediate(async () => {
                for await (const msg of subscription) {
                    await handleMessage(msg)
                }
            })
        } else {
            subscription.callback = async (err: Error | null, msg: Msg): Promise<void> => {
                // nats.js 在订阅级错误时以 (err, {}) 回调,此时 msg 为空对象无法处理,上报后返回。
                if (err) {
                    this.emitError(err)
                    return
                }
                await handleMessage(msg)
            }
        }
        return subscription
    }

    /**
     * 安全地发出 error 事件:仅在存在监听器时发出。
     * Node EventEmitter 在没有 'error' 监听器时 emit('error') 会抛出,
     * 在异步回调里那会变成 unhandled rejection,所以这里加监听器守卫。
     * @param error
     * @protected
     */
    protected emitError(error: any): void {
        if (this.listenerCount('error') > 0) this.emit('error', error)
    }

    /**
     * 是否启用了 bulk 旁路(连接 + Object Store 均就绪)
     */
    public get bulkEnabled(): boolean {
        return !!this.bulk && !!this.#objectStore
    }

    /**
     * 走 bulk 的字节阈值 = server max_payload × 0.9(从连接 info 自动读,跟随集群配置)
     */
    public get bulkThreshold(): number {
        const maxPayload: number = this.#conn.info?.max_payload ?? 1024 * 1024
        return Math.floor(maxPayload * 0.9)
    }

    /**
     * server 是否支持消息 header(从连接 info)
     */
    public get headersSupported(): boolean {
        return this.#conn.info?.headers === true
    }

    /**
     * 把一块字节存入 Object Store,返回 objId(供引用中转)。
     * @param bytes
     */
    public async putBulk(bytes: Uint8Array): Promise<string> {
        if (!this.#objectStore) throw new NatsBulkException('bulk channel is not enabled')
        const objId: string = randomUUID()
        try {
            await this.#objectStore.putBlob({name: objId}, bytes)
        } catch (e: any) {
            throw new NatsBulkException(`bulk put failed: ${e?.message ?? e}`)
        }
        return objId
    }

    /**
     * 从 Object Store 取回一块字节。
     * @param objId
     */
    public async getBulk(objId: string): Promise<Uint8Array> {
        if (!this.#objectStore) throw new NatsBulkException('bulk channel is not enabled')
        let data: Uint8Array | null
        try {
            data = await this.#objectStore.getBlob(objId)
        } catch (e: any) {
            throw new NatsBulkException(`bulk get failed: ${e?.message ?? e}`)
        }
        if (data === null) throw new NatsBulkException(`bulk object not found: ${objId}`)
        return data
    }

    /**
     * 删除 Object Store 中的对象(用完即清,失败由 TTL 兜底)。
     * @param objId
     */
    public async deleteBulk(objId: string): Promise<void> {
        if (!this.#objectStore) return
        await this.#objectStore.delete(objId)
    }

    /**
     * 返回 bulk Object Store 的运行时状态(bucket/ttl/replicas/storage/size 等);未启用 bulk 返回 undefined。
     */
    public async bulkStatus(): Promise<ObjectStoreStatus | undefined> {
        return this.#objectStore?.status()
    }

    /**
     * 打包待发送 payload:编码后若对端支持中转且超阈值,存入 Object Store 改发小引用。
     * @param payload
     * @param peerSupportsBulk 对端是否支持引用中转(不支持只能直传)
     * @private
     */
    private async packPayload(payload: any, peerSupportsBulk: boolean): Promise<{bytes: Uint8Array, isRef: boolean, objId?: string}> {
        const bytes: Uint8Array = this.codec.encode(payload)
        if (peerSupportsBulk && this.bulkEnabled && bytes.length >= this.bulkThreshold) {
            const objId: string = await this.putBulk(bytes)
            return {bytes: this.codec.encode({__ref: objId}), isRef: true, objId}
        }
        return {bytes, isRef: false}
    }

    /**
     * 解包收到的字节:若是引用,从 Object Store 取回真实字节再解码(取回后即删,失败靠 TTL 兜底)。
     * @param bytes
     * @param isRef
     * @private
     */
    private async unpackPayload(bytes: Uint8Array, isRef: boolean): Promise<any> {
        if (isRef) {
            const ref: any = this.codec.decode(bytes)
            const realBytes: Uint8Array = await this.getBulk(ref.__ref)
            this.deleteBulk(ref.__ref).catch((): void => undefined)
            return this.codec.decode(realBytes)
        }
        return this.codec.decode(bytes)
    }

    /**
     * Emit service event
     * @param eventName
     * @param args
     */
    public emitServiceEvent(eventName: string, ...args: any[]): this {
        const eventSubject: string = ServiceEventCodec.formatSubject(this.app.appId, eventName)
        this.publish(eventSubject, ServiceEventCodec.encode(args))
        return this
    }

    /**
     * On service event
     * @param serviceId
     * @param eventName
     * @param listener
     * @param onlySingleClientReceived
     */
    public onServiceEvent(serviceId: string, eventName: string, listener: (...args: any[]) => void, onlySingleClientReceived: boolean = false): this {
        const eventSubject: string = ServiceEventCodec.formatSubject(serviceId, eventName)
        if (!this.serviceEventSubscriptionMap.has(eventSubject)) this.serviceEventSubscriptionMap.set(eventSubject, new Map())
        if (!this.serviceEventSubscriptionMap.get(eventSubject)?.has(listener)) {
            const subscription: Subscription = this.subscribe(eventSubject, (eventData: ServiceEventData) => {
                listener(...ServiceEventCodec.decode(eventData))
            }, onlySingleClientReceived ? {queue: eventSubject} : void (0))
            this.serviceEventSubscriptionMap.get(eventSubject)?.set(listener, subscription)
        }
        return this
    }

    /**
     * Once service event
     * @param serviceId
     * @param eventName
     * @param listener
     */
    public onceServiceEvent(serviceId: string, eventName: string, listener: (...args: any[]) => void): this {
        const eventSubject: string = ServiceEventCodec.formatSubject(serviceId, eventName)
        if (!this.serviceEventSubscriptionMap.has(eventSubject)) this.serviceEventSubscriptionMap.set(eventSubject, new Map())
        if (!this.serviceEventSubscriptionMap.get(eventSubject)?.has(listener)) {
            const subscription: Subscription = this.subscribe(eventSubject, (eventData: ServiceEventData) => {
                this.serviceEventSubscriptionMap.get(eventSubject)?.delete(listener)
                listener(...ServiceEventCodec.decode(eventData))
            }, {max: 1})
            this.serviceEventSubscriptionMap.get(eventSubject)?.set(listener, subscription)
        }
        return this
    }

    /**
     * Off server events
     * @param serviceId
     * @param eventName
     * @param listener
     */
    public offServiceEvent(serviceId: string, eventName: string, listener?: (...args: any[]) => void): this {
        const eventSubject: string = ServiceEventCodec.formatSubject(serviceId, eventName)
        if (listener) {
            this.serviceEventSubscriptionMap.get(eventSubject)?.get(listener)?.unsubscribe()
            this.serviceEventSubscriptionMap.get(eventSubject)?.delete(listener)
        } else {
            this.serviceEventSubscriptionMap.get(eventSubject)?.forEach((subscription: Subscription) => subscription.unsubscribe())
            this.serviceEventSubscriptionMap.delete(eventSubject)
        }
        return this
    }
}

