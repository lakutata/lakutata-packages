import {Information} from '../lib/providers/Information'
import {Creator} from '../lib/providers/Creator'
import {type ActionPattern, DTO} from 'lakutata'
import {Inject} from 'lakutata/decorator/di'
import {CLIAction} from 'lakutata/decorator/ctrl'
import {Controller} from 'lakutata/com/entrypoint'
import {ListTemplatesOptions} from '../options/ListTemplatesOptions'
import {TemplateManager} from '../lib/providers/TemplateManager'
import {CreateProjectOptions} from '../options/CreateProjectOptions'
import {ConvertDTO2Inquirer} from '../lib/ConvertDTO2Inquirer'

export class CommandLineController extends Controller {

    @Inject('creator')
    protected readonly projectCreator: Creator

    @Inject('info')
    protected readonly frameworkInfo: Information

    @Inject('templateManager')
    protected readonly templateManager: TemplateManager

    /**
     * Create project
     */
    @CLIAction('create', DTO.description('create a Lakutata project'))
    public async create(): Promise<void> {
        await this.projectCreator.create(await ConvertDTO2Inquirer(CreateProjectOptions))
    }

    /**
     * List templates
     * @param inp
     */
    @CLIAction('templates', ListTemplatesOptions.description('list available project templates'))
    public async templates(inp: ActionPattern<ListTemplatesOptions>): Promise<void> {
        await this.templateManager.list(inp)
    }

    /**
     * Show framework info
     */
    @CLIAction('info', DTO.description('show Lakutata framework info'))
    public async info(): Promise<void> {
        await this.frameworkInfo.print()
    }
}
