import koffi from 'koffi'
import {TypeSpec} from './types/TypeSpec'

/**
 * Get the size of a type
 * @param type
 * @constructor
 */
export function SizeOf(type: TypeSpec): number {
    return koffi.sizeof(type)
}
