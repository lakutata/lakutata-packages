import {ActionPattern, Application, DTO, Provider, ProviderOptionsBuilder} from 'lakutata'
import {Configurable, Inject, Singleton} from 'lakutata/decorator/di'
import {Delay} from 'lakutata/helper'
import {NATS} from '../components/NATS'
import {ServiceResponseCodec} from '../lib/ServiceResponseCodec'
import {NatsNoRespondersAvailableException} from '../exceptions/NatsNoRespondersAvailableException'

/**
 * Build service proxy options
 */
export type BuildServiceProxyOptions = {
    readonly natsComponentName: string
    readonly serviceId: string
    /** 仅对 NoResponders(对侧确定没处理)自动重试的次数,默认 3;超时/业务异常不重试 */
    readonly maxRetries?: number
    /** 每次重试前等待的毫秒,默认 100 */
    readonly retryDelay?: number
}

/**
 * Build service proxy
 * @param options
 * @constructor
 */
export const BuildServiceProxy: ProviderOptionsBuilder<BuildServiceProxyOptions> = (options: BuildServiceProxyOptions) => {
    return {
        class: ServiceProxy,
        natsComponentName: options.natsComponentName,
        serviceId: options.serviceId,
        maxRetries: options.maxRetries,
        retryDelay: options.retryDelay
    }
}

/**
 * Service proxy provider
 */
@Singleton()
export class ServiceProxy extends Provider {
    /**
     * Inject application instance
     * @protected
     */
    @Inject(Application)
    protected readonly app: Application

    /**
     * NATS registered component name
     * @protected
     */
    @Configurable(DTO.String().required())
    protected readonly natsComponentName: string

    /**
     * Service ID
     * @protected
     */
    @Configurable(DTO.String().required())
    protected readonly serviceId: string

    /**
     * 仅对 NoResponders(对侧确定没处理)自动重试的次数;超时/业务异常不重试。
     * @protected
     */
    @Configurable(DTO.Number().integer().optional().default(3))
    protected readonly maxRetries: number

    /**
     * 每次重试前等待的毫秒。
     * @protected
     */
    @Configurable(DTO.Number().integer().optional().default(100))
    protected readonly retryDelay: number

    /**
     * NATS component instance
     * @protected
     */
    protected nats: NATS

    /**
     * Initializer
     * @protected
     */
    protected async init(): Promise<void> {
        this.nats = await this.app.getObject<NATS>(this.natsComponentName)
    }

    /**
     * Invoke service registered method by pattern
     * @param input
     * @param timeout 默认 10 分钟。服务不存在/无响应者由 NoResponders 立即失败,此超时仅兜底"已被接收但处理太慢"的情况;已知的慢操作可显式传更长值。
     */
    public async invoke<T extends Record<string, any>>(input: ActionPattern<T>, timeout: number = 10 * 60 * 1000): Promise<any> {
        // 安全重试红线:只对 NoResponders 重试 —— NATS 明确告知"当时没人订阅",对侧【确定没处理】,
        // 重试到其他副本是首次处理,不会重复。超时(可能已处理但响应丢失)、业务异常(对侧已处理并返回)
        // 都【不】重试,直接抛给调用方,避免重复执行非幂等操作。
        for (let attempt = 0; ; attempt++) {
            try {
                const response: any = await this.nats.request(this.serviceId, input, timeout)
                return ServiceResponseCodec.decode(response, this.serviceId)
            } catch (e) {
                if (e instanceof NatsNoRespondersAvailableException && attempt < this.maxRetries) {
                    await Delay(this.retryDelay)
                    continue
                }
                throw e
            }
        }
    }

    /**
     * On service event
     * @param eventName
     * @param listener
     * @param onlySingleClientReceived
     */
    public on(eventName: string, listener: (...args: any[]) => void, onlySingleClientReceived: boolean = false): this {
        this.nats.onServiceEvent(this.serviceId, eventName, listener, onlySingleClientReceived)
        return this
    }

    /**
     * Once service event
     * @param eventName
     * @param listener
     */
    public once(eventName: string, listener: (...args: any[]) => void): this {
        this.nats.onceServiceEvent(this.serviceId, eventName, listener)
        return this
    }

    /**
     * Off service events
     * @param eventName
     * @param listener
     */
    public off(eventName: string, listener?: (...args: any[]) => void): this {
        this.nats.offServiceEvent(this.serviceId, eventName, listener)
        return this
    }
}