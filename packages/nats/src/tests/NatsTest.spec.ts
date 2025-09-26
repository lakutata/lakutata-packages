import {Application, Component} from 'lakutata'
import {BuildEntrypoints, Controller} from 'lakutata/com/entrypoint'
import {Inject} from 'lakutata/decorator/di'
import {SetupNatsServiceEntrypoint, NATS, buildNatsClientOptions} from '../CommonExports'
import {ServiceAction} from 'lakutata/decorator/ctrl'


class TestComponent extends Component {

    @Inject(Application)
    protected readonly app: Application

    @Inject('nats')
    protected readonly nats: NATS

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
        console.log(await this.nats.request(this.app.appId, JSON.stringify({test: true})))
    }
}

class TestController extends Controller {
    @ServiceAction({test: true})
    public async test(inp) {
        return 'hahahah'
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
            servers: '127.0.0.1:4222'
        }),
        test: {
            class: TestComponent
        }
    },
    bootstrap: [
        'entrypoint',
        'test'
    ]
})