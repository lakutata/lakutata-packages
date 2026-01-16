import {Application, Component} from 'lakutata'
import {BuildEntrypoints, Controller} from 'lakutata/com/entrypoint'
import {Inject} from 'lakutata/decorator/di'
import {
    SetupNatsServiceEntrypoint,
    NATS,
    buildNatsClientOptions,
    NatsForbiddenException,
    BuildServiceProxy
} from '../CommonExports'
import {ServiceAction} from 'lakutata/decorator/ctrl'
import {Delay} from 'lakutata/helper'
import {ServiceProxy} from '../providers/ServiceProxy'


class TestComponent extends Component {

    @Inject(Application)
    protected readonly app: Application

    @Inject('nats')
    protected readonly nats: NATS

    @Inject('self')
    protected readonly self: ServiceProxy

    protected async init(): Promise<void> {
        // this.nats.subscribe('test-invoke', (msg) => {
        //     console.log('msg:', msg)
        //     return Date.now()
        // })
        // this.nats.subscribe('test', (data: any) => {
        //     console.log(data)
        // })
        //
        // setInterval(async () => {
        //     this.nats.publish('test', 1234)
        //     console.log('res:', await this.nats.request('test-invoke', JSON.stringify({haha: true})), 1000000)
        // }, 1)
        // console.log(await this.nats.request(this.app.appId, {test: true}))
        // this.nats.subscribe('test', async (inp) => {
        //     console.log(inp)
        //     await Delay(1000)
        // }, {iterator: true})
        //
        // for (let i = 0; i < 1000; i++) {
        //     this.nats.publish('test', i)
        // }
        const handler1 = async (data1, data2) => {
            console.log('data1:', data1, data2)
            // this.nats.offServiceEvent(this.app.appId, 'testEvt', handler1)
            // this.self.off('testEvt', handler1)
        }
        const handler2 = async (data1, data2) => {
            console.log('data2:', data1, data2)
            // this.nats.offServiceEvent(this.app.appId, 'testEvt', handler1)
            // this.nats.offServiceEvent(this.app.appId, 'testEvt')
        }
        this.self.on('testEvt', handler1)
        this.self.on('testEvt', handler2)
        // this.nats.onServiceEvent(this.app.appId, 'testEvt', handler1)
        // this.nats.onServiceEvent(this.app.appId, 'testEvt', handler2)
        // setInterval(() => {
        //     this.nats.emitServiceEvent('testEvt', 123, 456)
        // }, 1000)
        try {
            console.log(await this.self.invoke({test: true, start: new Date()}))
        } catch (e) {
            // console.error(JSON.parse(JSON.stringify(e)))
            console.error(e)
        }
        try {
            const task = await this.nats.createTask('tasks.test1', async (data) => {
                console.log('task2:', data)
            })
            await task.publish({time: Date.now()})
        } catch (e) {
            console.error(e)
        }
    }
}

class TestController extends Controller {
    @ServiceAction({test: true})
    public async test(inp) {
        console.log(inp)
        // throw new Error('fuck')
        // throw new NatsForbiddenException('fuck')
        // return 'hahahah'
        return {
            test: true,
            num: 1234,
            sub: {
                a: 1234,
                b: '1234234',
                c: [{test: true}]
            }
        }
        // return ['hahahah']
        // return {
        //     test: 123456
        // }
    }
}

Application.run({
    id: 'test.app',
    name: 'TestApp',
    components: {
        entrypoint: BuildEntrypoints({
            controllers: [TestController],
            service: SetupNatsServiceEntrypoint('nats')
        }),
        nats: buildNatsClientOptions({
            // servers: '127.0.0.1:4222'
            servers: '10.11.11.21:30422'
        }),
        test: {
            class: TestComponent
        }
    },
    providers: {
        self: BuildServiceProxy({serviceId: 'test.app', natsComponentName: 'nats'})
    },
    bootstrap: [
        'entrypoint',
        'test'
    ]
})