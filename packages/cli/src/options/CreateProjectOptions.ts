import {ProjectTypeConfig} from '../lib/ProjectTypeConfig'
import {DTO} from 'lakutata'
import {Expect} from 'lakutata/decorator/dto'

/**
 * Create project options
 */
export class CreateProjectOptions extends DTO {

    @Expect(
        DTO
            .String()
            .required()
            .pattern(/^(\w+\.?)*\w+$/)
            .description('specify the name of the project and application')
    )
    public name: string

    @Expect(
        DTO
            .String()
            .required()
            .pattern(/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/)//Match package json name regex
            .description('specify the ID of the application')
    )
    public id: string

    @Expect(
        DTO
            .String()
            .required()
            .valid(...Object.keys(ProjectTypeConfig))
            .description(`select the type of the project (choices: ${Object.keys(ProjectTypeConfig).map((type: string): string => `"${type}"`).join(',')})`)
    )
    public type: string

    @Expect(
        DTO
            .String()
            .optional()
            .default(process.cwd())
            .description(`specify the path for creating the project (default: "${process.cwd()}")`)
    )
    public path: string

    @Expect(
        DTO
            .Boolean()
            .strict(false)
            .optional()
            .default(false)
            .description('initialize project only in specified directory without creating a new folder (default: false)')
    )
    public initOnly: boolean

    @Expect(
        DTO
            .String()
            .optional()
            .default('none')
            .description('specify the description of the application (default: "none")')
    )
    public description: string

    @Expect(
        DTO
            .String()
            .optional()
            .default('Anonymous')
            .description('specify the name of the author of the application (default: "Anonymous")')
    )
    public author: string

    @Expect(
        DTO
            .String()
            .optional()
            .default('UNLICENSED')
            .description('specify the name of the license for the application (default: "UNLICENSED")')
    )
    public license: string
}
