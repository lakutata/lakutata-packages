import {DTO, Provider} from 'lakutata'
import {Configurable} from 'lakutata/decorator/di'
import {
    AckPolicy,
    type Codec,
    DeliverPolicy,
    RetentionPolicy,
    StreamInfo,
    type JetStreamClient,
    type JetStreamManager,
    Consumer,
    ConsumerInfo,
    JsMsg
} from 'nats'
import {Delay, MD5} from 'lakutata/helper'

export class Task extends Provider {

    #requestTask: boolean = true

    @Configurable()
    protected readonly jetStreamManager: JetStreamManager

    @Configurable()
    protected readonly jetStream: JetStreamClient

    @Configurable(DTO.String().required())
    protected readonly subject: string

    @Configurable(DTO.Function().optional())
    protected readonly handler?: (data: any) => void | Promise<void>

    /**
     * NATS message codec
     * @protected
     */
    @Configurable(DTO.Object({
        encode: DTO.Function().arity(1).required(),
        decode: DTO.Function().arity(1).required()
    }).required())
    protected readonly codec: Codec<unknown>

    protected get streamName(): string {
        return MD5(this.subject).toString('hex')
    }

    /**
     * Initializer
     * @protected
     */
    protected async init(): Promise<void> {
        let streamName: string | null = await this.getExistsStreamName()
        if (!streamName) {
            const streamInfo: StreamInfo = await this.jetStreamManager.streams.add({
                name: this.streamName,
                subjects: [this.subject],
                retention: RetentionPolicy.Workqueue,
                max_msgs: -1,
                max_age: 0,
                max_bytes: -1,
                max_msg_size: -1,
                no_ack: false
            })
            streamName = streamInfo.config.name
        }
        if (this.handler) {
            const consumerInfo: ConsumerInfo = await this.jetStreamManager.consumers.add(streamName, {
                durable_name: this.streamName,
                deliver_policy: DeliverPolicy.All,
                ack_policy: AckPolicy.Explicit,
                deliver_group: this.streamName
            })
            const consumer: Consumer = await this.jetStream.consumers.get(consumerInfo.stream_name, consumerInfo.name)
            setImmediate(async () => {
                while (this.#requestTask) {
                    const msg: JsMsg | null = await consumer.next()
                    if (!msg) {
                        await Delay(10)
                        continue
                    }
                    await this.handler!(this.codec.decode(msg.data))
                    msg.ack()
                }
                await consumer.delete()
            })
        }
    }

    /**
     * Destroyer
     * @protected
     */
    protected async destroy(): Promise<void> {
        this.#requestTask = false
    }

    /**
     * Get exists stream name
     * @protected
     */
    protected async getExistsStreamName(): Promise<string | null> {
        try {
            return await this.jetStreamManager.streams.find(this.subject)
        } catch (e) {
            return null
        }
    }

    /**
     * Publish task
     * @param payload
     */
    public async publish(payload: any): Promise<void> {
        await this.jetStream.publish(this.subject, this.codec.encode(payload))
    }
}