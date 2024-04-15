import koffi from 'koffi'
import {TypeSpec} from './types/TypeSpec'

/**
 * @see https://koffi.dev/unions#output-unions
 */
export class Union extends koffi.Union {
    constructor(type: TypeSpec) {
        super(type)
    }

    [s: string]: any
}
