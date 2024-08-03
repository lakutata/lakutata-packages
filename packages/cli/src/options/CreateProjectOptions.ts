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
            .description('choose a template for this project')
    )
    public template: string

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
            .description('initialize the project within an existing folder (default: false)')
    )
    public overwrite: boolean

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
