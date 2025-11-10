import {ActionPattern, Application, DTO, Provider, ProviderOptionsBuilder} from 'lakutata'
import {Configurable, Inject, Singleton} from 'lakutata/decorator/di'
import {NATS} from '../components/NATS'
import {ServiceResponseCodec} from '../lib/ServiceResponseCodec'

/**
 * Build service proxy options
 */
export type BuildServiceProxyOptions = {
    readonly natsComponentName: string
    readonly serviceId: string
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
        serviceId: options.serviceId
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
     * @param timeout
     */
    public async invoke<T extends Record<string, any>>(input: ActionPattern<T>, timeout: number = 60 * 60 * 1000): Promise<any> {
        const response: any = await this.nats.request(this.serviceId, input, timeout)
        return ServiceResponseCodec.decode(response)
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