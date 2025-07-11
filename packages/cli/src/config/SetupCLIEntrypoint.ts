import {BuildCLIEntrypoint, CLIContext, CLIEntrypoint, CLIEntrypointHandler, CLIMap} from 'lakutata/com/entrypoint'
import {JSONSchema, Module} from 'lakutata'
import {Command} from 'commander'

export function SetupCLIEntrypoint(): CLIEntrypoint {
    return BuildCLIEntrypoint((module: Module, cliMap: CLIMap, handler: CLIEntrypointHandler): void => {
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
}