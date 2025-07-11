import {Application, DTO, Provider, Time} from 'lakutata'
import {ListTemplatesOptions} from '../../options/ListTemplatesOptions'
import {Accept} from 'lakutata/decorator/dto'
import CLITable from 'cli-table3'
import ansis from 'ansis'
import * as console from 'node:console'
import path from 'node:path'
import {Configurable, Inject} from 'lakutata/decorator/di'
import fetch from 'node-fetch-native'
import {Logger} from 'lakutata/com/logger'
import {As, IsExists} from 'lakutata/helper'
import {Spinner} from '../components/Spinner'
import {readFile, writeFile} from 'node:fs/promises'
import {GetLocalDataFilename} from '../GetLocalDataFilename'

type TemplateInfo = {
    name: string
    description: string
    repository: string
}

type localTemplateInfoCache = {
    version: string
    templates: TemplateInfo[]
    updatedAt: number
}

export class TemplateManager extends Provider {

    @Inject(Application)
    protected readonly app: Application

    @Inject('log')
    protected readonly log: Logger

    @Inject('spinner')
    protected readonly spinner: Spinner

    @Configurable(DTO.String().required())
    protected readonly apiHost: string

    @Configurable(DTO.String().required())
    protected readonly repoPrefix: string

    protected readonly localDataFilename: string = GetLocalDataFilename()

    /**
     * Fetch template repository list from remote
     * @protected
     */
    protected async fetchTemplateRepos(): Promise<TemplateInfo[]> {
        this.spinner.start('Fetching')
        const url: URL = new URL(this.apiHost)
        url.pathname = '/users/lakutata/repos'
        const fetchResponse: Response = await fetch(url.toString(), {method: 'get'})
        if (fetchResponse.status >= 400) {
            this.spinner.stop()
            this.log.error('Failed to obtain template repository list: (%s) %s', fetchResponse.status, fetchResponse.statusText)
            this.app.exit(1)
        }
        const rawRepos: Record<string, any>[] = As(await fetchResponse.json())
        const templateRepos: Record<string, any>[] = rawRepos.filter((rawRepo: Record<string, any>) => {
            const repoName: string = rawRepo.name
            return repoName.startsWith(this.repoPrefix) && repoName !== this.repoPrefix
        })
        this.spinner.stop()
        return templateRepos.map((templateRepo: Record<string, any>): TemplateInfo => {
            const repoName: string = templateRepo.name
            return {
                name: repoName.replace(`${this.repoPrefix}-`, ''),
                description: templateRepo.description,
                repository: templateRepo.full_name
            }
        }).sort((a: TemplateInfo, b: TemplateInfo): number => b.name === 'default' ? 1 : 0)
    }

    /**
     * List templates
     * @param options
     */
    @Accept(ListTemplatesOptions.required())
    public async list(options: ListTemplatesOptions): Promise<void> {
        const {version} = JSON.parse(await readFile(path.resolve('@packageJson'), {encoding: 'utf-8'}))
        const isLocalDataExists: boolean = await IsExists(this.localDataFilename)
        let isLocalDataVersionMatched: boolean = false
        let cache: localTemplateInfoCache = {
            templates: [],
            version: version,
            updatedAt: Time.now()
        }
        if (isLocalDataExists) {
            cache = JSON.parse(await readFile(this.localDataFilename, {encoding: 'utf-8'}))
            isLocalDataVersionMatched = cache.version === version
        }
        if (!isLocalDataExists || !isLocalDataVersionMatched || options.refresh) {
            const templates: TemplateInfo[] = await this.fetchTemplateRepos()
            cache = {
                templates: templates,
                version: version,
                updatedAt: Time.now()
            }
            await writeFile(this.localDataFilename, JSON.stringify(cache), {flag: 'w'})
        }
        this.printTemplates(cache.templates, cache.updatedAt)
    }

    /**
     * Print template information to console
     * @param templateInfos
     * @param updatedAt
     * @protected
     */
    protected printTemplates(templateInfos: TemplateInfo[], updatedAt: number): void {
        const table: CLITable.Table = new CLITable()
        table.push(
            [
                {content: ansis.bold.cyan('Name'), hAlign: 'center'},
                {content: ansis.bold.cyan('Description'), hAlign: 'center'},
                {content: ansis.bold.cyan('Repository'), hAlign: 'center'}
            ],
            ...templateInfos.map((templateInfo: TemplateInfo): string[] => {
                return [
                    templateInfo.name,
                    templateInfo.description,
                    templateInfo.repository
                ]
            })
        )
        console.log(table.toString())
        console.log(`Template list last updated on: ${ansis.bold(new Time(updatedAt).format('YYYY-MM-DD HH:mm:ss'))}`)
    }
}
