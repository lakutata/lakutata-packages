import {CreateProjectOptions} from '../options/CreateProjectOptions'
import {LakutataInfoOptions} from '../options/LakutataInfoOptions'
import {Information} from '../lib/providers/Information'
import {Creator} from '../lib/providers/Creator'
import {type ActionPattern, Controller} from 'lakutata'
import {Inject} from 'lakutata/decorator/di'
import {CLIAction} from 'lakutata/decorator/ctrl'

export class CommandLineController extends Controller {

    @Inject('creator')
    protected readonly projectCreator: Creator

    @Inject('info')
    protected readonly frameworkInfo: Information

    /**
     * Create project
     * @param inp
     */
    @CLIAction('create', CreateProjectOptions.description('create a Lakutata project'))
    public async create(inp: ActionPattern<CreateProjectOptions>): Promise<void> {
        await this.projectCreator.create(inp)
    }

    /**
     * Show framework info
     * @param inp
     */
    @CLIAction('info', LakutataInfoOptions.description('show Lakutata framework info'))
    public async info(inp: ActionPattern<LakutataInfoOptions>): Promise<void> {
        await this.frameworkInfo.print()
    }
}
