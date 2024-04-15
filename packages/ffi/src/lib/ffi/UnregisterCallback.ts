import koffi from 'koffi'
import {IRegisteredCallback} from './interfaces/IRegisteredCallback'

/**
 * Unregister js callback
 * @see https://koffi.dev/callbacks#callback-types
 * @param callback
 * @constructor
 */
export function UnregisterCallback(callback: IRegisteredCallback): void {
    return koffi.unregister(callback)
}
