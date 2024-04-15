#!/usr/bin/env node

import {Command} from 'commander'
import {CommandLineController} from './controllers/CommandLineController'
import {Information} from './lib/providers/Information'
import {
    name as packageName,
    version as packageVersion,
    description as packageDescription,
    license as packageLicense
} from 'lakutata/package.json'
import {Creator} from './lib/providers/Creator'
import {DeGitPuller} from './lib/components/DeGitPuller'
import {Spinner} from './lib/components/Spinner'
import {dots} from 'cli-spinners'
import {Application, ApplicationOptions, JSONSchema, Module} from 'lakutata'
import {
    BuildCLIEntrypoint,
    BuildEntrypoints,
    CLIContext,
    CLIEntrypointHandler,
    CLIMap,
    EntrypointDestroyerRegistrar
} from 'lakutata/com/entrypoint'

Application.run(async (): Promise<ApplicationOptions> => ({
    id: 'cli.lakutata.app',
    name: 'Lakutata-CLI',
    components: {
        puller: {
            class: DeGitPuller,
            cache: false,
            verbose: true,
            force: true,
            repo: 'lakutata/lakutata-template'
        },
        spinner: {
            class: Spinner,
            style: dots
        },
        entrypoint: BuildEntrypoints({
            controllers: [CommandLineController],
            cli: BuildCLIEntrypoint((module: Module, cliMap: CLIMap, handler: CLIEntrypointHandler, registerDestroy: EntrypointDestroyerRegistrar) => {
                const CLIProgram: Command = new Command()
                cliMap.forEach((dtoJsonSchema: JSONSchema, command: string): void => {
                    const cmd: Command = new Command(command).description(dtoJsonSchema.description!)
                    for (const property in dtoJsonSchema.properties) {
                        const attr: JSONSchema = dtoJsonSchema.properties[property]
                        const optionsArgs: [string, string | undefined] = [`--${property} <${attr.type}>`, attr.description]
                        if (Array.isArray(dtoJsonSchema.required) && dtoJsonSchema.required.includes(property)) {
                            optionsArgs[1] = `(required) ${optionsArgs[1]}`
                            cmd.requiredOption(...optionsArgs)
                        } else {
                            cmd.option(...optionsArgs)
                        }
                    }
                    cmd.action(async (args): Promise<any> => await handler(new CLIContext({
                        command: command,
                        data: args
                    })))
                    CLIProgram.addCommand(cmd)
                })
                CLIProgram.parse()
            })
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
        }
    },
    bootstrap: ['entrypoint']
}))
    .onUncaughtException((error: Error) => {
        console.error(`error: ${error.message}`)
        return process.exit(1)
    })
