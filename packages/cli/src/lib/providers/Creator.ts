import {Information} from './Information.js'
import {DeGitPuller} from '../components/DeGitPuller.js'
import {Spinner} from '../components/Spinner.js'
import {CreateProjectOptions} from '../../options/CreateProjectOptions.js'
import path from 'node:path'
import {mkdir, readdir, readFile, stat, writeFile} from 'node:fs/promises'
import {Stats} from 'node:fs'
import {charCheck, charCross} from '../SpecialChar.js'
import {Application, Provider} from 'lakutata'
import {Inject} from 'lakutata/decorator/di'
import {Logger} from 'lakutata/com/logger'
import {Glob, IsExists, Templating} from 'lakutata/helper'
import {Accept} from 'lakutata/decorator/dto'
import ansis from 'ansis'
import CLITable from 'cli-table3'
import {OnlineLatestVersion} from './OnlineLatestVersion'

export class Creator extends Provider {

    @Inject(Application)
    protected readonly app: Application

    @Inject('log')
    protected readonly log: Logger

    @Inject('spinner')
    protected readonly spinner: Spinner

    @Inject('puller')
    protected readonly puller: DeGitPuller

    @Inject('info')
    protected readonly frameworkInfo: Information

    @Inject('onlineVersion')
    protected readonly onlineVersion: OnlineLatestVersion

    /**
     * Check if the target path exists
     * @param targetDirectory
     * @param initOnly
     * @protected
     */
    protected async checkTargetPathExistence(targetDirectory: string, initOnly: boolean): Promise<void> {
        const exists: boolean = await IsExists(targetDirectory)
        if (!exists && initOnly) {
            this.log.error(`${charCross} The target path does not exist.`)
            return this.app.exit(1)
        }
        await mkdir(targetDirectory, {recursive: true})
        this.log.info(`${charCheck} The target path does not exist.`)
    }

    /**
     * Check target path is a valid directory
     * @param targetDirectory
     * @protected
     */
    protected async checkTargetPathIsDirectory(targetDirectory: string): Promise<void> {
        const targetInfo: Stats = await stat(targetDirectory)
        if (!targetInfo.isDirectory()) {
            this.log.error(`${charCross} The target path is not a valid directory.`)
            return this.app.exit(1)
        }
        this.log.info(`${charCheck} The target path is a valid directory.`)
    }

    /**
     * Check target directory is empty, if the target directory is not empty, throw error and exit
     * @param targetDirectory
     * @param initOnly
     * @protected
     */
    protected async checkTargetDirectoryIsEmpty(targetDirectory: string, initOnly: boolean): Promise<void> {
        const files: string[] = await readdir(targetDirectory)
        if (files.length && !initOnly) {
            this.log.error(`${charCross} The target directory is not empty.`)
            return this.app.exit(1)
        }
        this.log.info(`${charCheck} The target directory is empty.`)
    }

    /**
     * project information filling
     * @protected
     */
    protected async projectInformationFilling(targetPath: string, fields: Record<string, string>): Promise<void> {
        const items: string[] = await Glob(path.resolve(targetPath, '**/*'))
        for (const item of items) {
            const stats: Stats = await stat(item)
            if (!stats.isFile()) continue
            const rawContent: string = await readFile(item, {encoding: 'utf-8'})
            const filledContent: string = Templating(rawContent, fields, {ignoreMissing: true})
            if (rawContent !== filledContent) await writeFile(item, filledContent, {flag: 'w'})
        }
    }

    /**
     * Exec create
     * @param options
     */
    @Accept(CreateProjectOptions.required())
    public async create(options: CreateProjectOptions): Promise<void> {
        const appName: string = options.name
        const appId: string = options.id
        const appDescription: string = options.description
        const authorName: string = options.author
        const licenseName: string = options.license
        const appTemplate: string = options.template
        const targetPath: string = options.overwrite ? path.resolve(options.path) : path.resolve(options.path, options.name)
        const table: CLITable.Table = new CLITable()
        table.push(
            [{content: ansis.bold.cyan('Project Creation Information'), colSpan: 2, hAlign: 'center'}],
            [ansis.blue('APP ID & Project Name'), appId],
            [ansis.blue('APP Name'), appName],
            [ansis.blue('APP Description'), appDescription],
            [ansis.blue('Project Create Target Path'), targetPath],
            [ansis.blue('Project Create Mode'), options.overwrite ? ansis.yellow('Initialize project in an existing directory') : ansis.green('Create a new folder for the project')],
            [ansis.blue('Project Author Name'), authorName],
            [ansis.blue('Project License'), licenseName],
            [ansis.blue('Project Template Repository'), this.puller.getGitSource(appTemplate)]
        )
        console.log(table.toString())
        await new Promise<void>(resolve => {
            let timeLeft: number = 10
            const interval: NodeJS.Timeout = setInterval((): void => {
                timeLeft -= 1
                if (!timeLeft) {
                    clearInterval(interval)
                    this.spinner.stop()
                    return resolve()
                }
            }, 1000)
            this.spinner.start((): string => `Please confirm the project creation information; the creation process will commence in ${timeLeft} seconds.`)
        })
        await this.checkTargetPathExistence(targetPath, options.overwrite)
        await this.checkTargetPathIsDirectory(targetPath)
        await this.checkTargetDirectoryIsEmpty(targetPath, options.overwrite)
        this.spinner.start('Pulling')
        await this.puller.pull(appTemplate, targetPath)
        this.spinner.stop()
        this.log.info(`${charCheck} Template pulled.`)
        this.spinner.start('Filling information')
        await this.projectInformationFilling(targetPath, {
            $APP_NAME: appName,
            $APP_ID: appId,
            $APP_DESC: appDescription,
            $APP_AUTHOR: authorName,
            $APP_LICENSE: licenseName
        })
        this.spinner.stop()
        this.log.info(`${charCheck} Project information filling completed.`)
        this.spinner.start('Installing')
        const {execa} = await import('execa')
        await execa('npm', ['install'], {cwd: targetPath})
        await execa('npm', ['install', `${this.onlineVersion.getName()}@${await this.onlineVersion.getVersion()}`], {cwd: targetPath})
        this.spinner.stop()
        this.log.info(`${charCheck} Project has been successfully created.`)
    }
}
