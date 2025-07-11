import {ActionPattern, DTO} from 'lakutata'
import inquirer from 'inquirer'

export async function ConvertDTO2Inquirer<InputDTO extends typeof DTO>(dto: InputDTO): Promise<ActionPattern<any>> {
    const jsonSchema = dto.toOpenAPIJsonSchema()
    const prompts: any[] = []
    for (const propertyName in jsonSchema.properties) {
        const propertyInfo = jsonSchema.properties[propertyName]
        const propertyRequired: boolean = Array.isArray(jsonSchema.required) && jsonSchema.required.includes(propertyName)
        switch (propertyInfo.type) {
            case 'boolean': {
                prompts.push({
                    name: propertyName,
                    type: 'confirm',
                    message: propertyInfo.description || '',
                    default: propertyInfo.default,
                    required: propertyRequired
                })
            }
                break
            case 'string':
            default: {
                if (propertyInfo.enum) {
                    const enums: string[] = propertyInfo.enum
                    prompts.push({
                        name: propertyName,
                        type: 'list',
                        message: propertyInfo.description || '',
                        required: propertyRequired,
                        choices: enums.map((value: string): { name: string; value: string } => ({
                            name: value,
                            value: value
                        })),
                        validate: (input: string): boolean => enums.includes(input)
                    })
                } else {
                    prompts.push({
                        name: propertyName,
                        type: 'input',
                        message: propertyInfo.description || '',
                        default: propertyInfo.default,
                        required: propertyRequired,
                        validate: (input: string): boolean => {
                            if (propertyInfo.pattern) {
                                return new RegExp(propertyInfo.pattern).test(input)
                            }
                            return true
                        }
                    })
                }
            }
        }
    }
    return inquirer.prompt(prompts)
}