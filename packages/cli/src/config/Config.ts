import {ApplicationOptions} from 'lakutata'
import {DeGitPuller} from '../lib/components/DeGitPuller'
import {Spinner} from '../lib/components/Spinner'
import {dots} from 'cli-spinners'
import {BuildEntrypoints} from 'lakutata/com/entrypoint'
import {CommandLineController} from '../controllers/CommandLineController'
import {Creator} from '../lib/providers/Creator'
import {Information} from '../lib/providers/Information'
import {
    name as packageName,
    version as packageVersion,
    description as packageDescription,
    license as packageLicense
} from 'lakutata/package.json'
import {TemplateManager} from '../lib/providers/TemplateManager'
import {OnlineLatestVersion} from '../lib/providers/OnlineLatestVersion'
import {SetupCLIEntrypoint} from './SetupCLIEntrypoint'

export async function Config(): Promise<ApplicationOptions> {
    return {
        id: 'cli.lakutata.app',
        name: 'Lakutata-CLI',
        components: {
            puller: {
                class: DeGitPuller,
                cache: false,
                verbose: true,
                force: true,
                baseRepo: 'lakutata/lakutata-template'
            },
            spinner: {
                class: Spinner,
                style: dots
            },
            entrypoint: BuildEntrypoints({
                controllers: [CommandLineController],
                cli: SetupCLIEntrypoint()
            })
        },
        providers: {
            creator: {
                class: Creator
            },
            info: {
                class: Information,
                name: packageName,
                version: packageVersion,
                description: packageDescription,
                license: packageLicense,
                currentDirectory: __dirname,
                workingDirectory: process.cwd()
            },
            onlineVersion: {
                class: OnlineLatestVersion,
                name: packageName,
                version: packageVersion
            },
            templateManager: {
                class: TemplateManager,
                apiHost: 'https://api.github.com',
                repoPrefix: 'lakutata-template'
            }
        },
        bootstrap: ['entrypoint']
    }
}