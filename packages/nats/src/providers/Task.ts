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
    nanos,
    ConsumerMessages,
    StreamConfig
} from 'nats'
import {MD5} from 'lakutata/helper'
import {Expect} from 'lakutata/decorator/dto'

export class TaskOptions extends DTO {
    @Expect(DTO.String().allow('limits', 'interest', 'workqueue').only().optional())
    public retention?: RetentionPolicy

    @Expect(DTO.Number().integer().allow(0).min(-1).optional())
    public maxMessages?: number

    @Expect(DTO.Number().integer().allow(0).min(0).optional())
    public maxAgeMs?: number

    @Expect(DTO.Number().integer().allow(0).min(-1).optional())
    public maxBytes?: number

    @Expect(DTO.Number().integer().allow(0).min(-1).optional())
    public maxMessageSize?: number

    @Expect(DTO.Number().allow(0).min(0).optional())
    public duplicateWindowMs?: number

    @Expect(DTO.Number().integer().min(1).optional())
    public concurrentTask?: number
}

export class Task extends Provider {

    #requestTask: boolean = true

    @Configurable()
    protected readonly jetStreamManager: JetStreamManager

    @Configurable()
    protected readonly jetStream: JetStreamClient

    @Configurable(DTO.String().required())
    protected readonly subject: string

    @Configurable(TaskOptions.Schema().default({}))
    protected readonly options: TaskOptions

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
        const streamConfig: Partial<StreamConfig> = {
            subjects: [this.subject],
            retention: this.options.retention || RetentionPolicy.Workqueue,
            max_msgs: this.options.maxMessages !== undefined ? this.options.maxMessages : -1,
            max_age: nanos(this.options.maxAgeMs || 0),
            max_bytes: this.options.maxBytes !== undefined ? this.options.maxBytes : -1,
            max_msg_size: this.options.maxMessageSize !== undefined ? this.options.maxMessageSize : -1,
            no_ack: false,
            duplicate_window: nanos(this.options.duplicateWindowMs ? this.options.duplicateWindowMs : 0)
        }
        if (!streamName) {
            //Add stream
            const streamInfo: StreamInfo = await this.jetStreamManager.streams.add({
                name: this.streamName,
                ...streamConfig
            })
            streamName = streamInfo.config.name
        } else {
            //Update stream
            let streamInfo: StreamInfo = await this.jetStreamManager.streams.info(streamName)
            const updateConfig = {
                ...streamInfo.config,
                ...streamConfig
            }
            streamInfo = await this.jetStreamManager.streams.update(streamName, updateConfig)
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
            const concurrentTask: number = this.options.concurrentTask || 1
            setImmediate(async () => {
                while (this.#requestTask) {
                    const msgs: ConsumerMessages = await consumer.consume({max_messages: concurrentTask})
                    const batchTasks: Promise<void>[] = []
                    for await (const msg of msgs) {
                        batchTasks.push(new Promise<void>(async (resolve, reject) => {
                            try {
                                await this.handler!(this.codec.decode(msg.data))
                                msg.ack()
                                return resolve()
                            } catch (e) {
                                msg.nak()
                                return reject(e)
                            }
                        }))
                    }
                    await Promise.all(batchTasks)
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
     * @param id
     */
    public async publish(payload: any, id?: string): Promise<void> {
        await this.jetStream.publish(this.subject, this.codec.encode(payload), {msgID: id})
    }
}