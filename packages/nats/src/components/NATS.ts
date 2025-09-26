import {
    Component,
    ComponentOptions,
    ComponentOptionsBuilder,
    DTO
} from 'lakutata'
import {Configurable} from 'lakutata/decorator/di'
import {type Codec, StringCodec, connect, NatsConnection, Msg, Subscription} from 'nats'
import {SubscribeOptions} from '../types/SubscribeOptions'
import {NatsBadRequestException} from '../exceptions/NatsBadRequestException'
import {NatsForbiddenException} from '../exceptions/NatsForbiddenException'
import {NatsNotFoundException} from '../exceptions/NatsNotFoundException'
import {NatsRequestTimeoutException} from '../exceptions/NatsRequestTimeoutException'
import {NatsNoRespondersAvailableException} from '../exceptions/NatsNoRespondersAvailableException'
import {NatsInternalServerException} from '../exceptions/NatsInternalServerException'
import {NatsClientOptions} from '../interfaces/NatsClientOptions'
import {JSONCodec} from '../codecs/JSONCodec'

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
        reconnect: options.reconnect
    }
}

export class NATS extends Component {
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
    }).optional().default(JSONCodec()))
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
     * NATS client instance
     * @private
     */
    #conn: NatsConnection

    /**
     * Initializer
     * @protected
     */
    protected async init(): Promise<void> {
        this.#conn = await connect({
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
        })
    }

    /**
     * Destroyer
     * @protected
     */
    protected async destroy(): Promise<void> {
        await this.#conn.close()
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
        try {
            const response: Msg = await this.#conn.request(subject, this.codec.encode(payload), {timeout: timeout ? timeout : 0})
            return this.codec.decode(response.data)
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
        return this.#conn.subscribe(subject, {
            queue: subscribeOptions?.queue,
            max: subscribeOptions?.max,
            callback: async (err: Error | null, msg: Msg): Promise<void> => {
                if (err) this.emit('error', err)
                const data: any = this.codec.decode(msg.data)
                const result: any = await callback(data)
                msg.respond(this.codec.encode(result))
            }
        })
    }
}

