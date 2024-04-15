import {TypeSpec} from './types/TypeSpec'
import koffi from 'koffi'

/**
 * Get the alignment of a type
 * @param type
 * @constructor
 */
export function AlignOf(type: TypeSpec): number {
    return koffi.alignof(type)
}
