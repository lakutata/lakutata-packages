import {DTO} from 'lakutata'
import {Expect} from 'lakutata/decorator/dto'

export class ListTemplatesOptions extends DTO {

    @Expect(
        DTO
            .Boolean()
            .strict(false)
            .optional()
            .default(false)
            .description('update the local list from the remote synchronized template repository list (default: false)')
    )
    public refresh: boolean
}
