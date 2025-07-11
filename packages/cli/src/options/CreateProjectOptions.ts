import {DTO} from 'lakutata'
import {Expect} from 'lakutata/decorator/dto'
import process from 'node:process'

function templateNames() {
    return process.env.LAKUTATA_TEMPLATE_NAMES ? JSON.parse(process.env.LAKUTATA_TEMPLATE_NAMES) : []
}

/**
 * Create project options
 */
export class CreateProjectOptions extends DTO {
    @Expect(
        DTO
            .String()
            .required()
            .pattern(/^(\w+\.?)*\w+$/)
            .description('Specify the name of the application')
    )
    public name: string

    @Expect(
        DTO
            .String()
            .required()
            .pattern(/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/)//Match package json name regex
            .description('Specify the ID of the application')
    )
    public id: string

    @Expect(
        DTO
            .String()
            .required()
            .allow(...templateNames())
            .only()
            .description('Choose a template for this project')
    )
    public template: string

    @Expect(
        DTO
            .String()
            .optional()
            .default(process.cwd())
            .description('Specify the path for creating the project')
    )
    public path: string

    @Expect(
        DTO
            .Boolean()
            .strict(false)
            .optional()
            .default(false)
            .description('Initialize the project within an existing folder')
    )
    public overwrite: boolean

    @Expect(
        DTO
            .String()
            .optional()
            .default('none')
            .description('Specify the description of the application')
    )
    public description: string

    @Expect(
        DTO
            .String()
            .optional()
            .default('Anonymous')
            .description('Specify the name of the author of the application')
    )
    public author: string

    @Expect(
        DTO
            .String()
            .optional()
            .default('UNLICENSED')
            .description('Specify the name of the license for the application')
    )
    public license: string
}
