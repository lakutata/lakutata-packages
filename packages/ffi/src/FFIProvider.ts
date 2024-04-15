import {DTO, Provider} from 'lakutata'
import {Configurable} from 'lakutata/decorator/di'
import 'reflect-metadata'
import {Library} from './lib/ffi/Library'

/**
 * FFI classes & functions
 */
export {AlignOf} from './lib/ffi/AlignOf'
export {SizeOf} from './lib/ffi/SizeOf'
export {RegisterCallback} from './lib/ffi/RegisterCallback'
export {UnregisterCallback} from './lib/ffi/UnregisterCallback'
export {Union} from './lib/ffi/Union'
export {TypeDef} from './lib/ffi/TypeDef'
export {Library} from './lib/ffi/Library'
export {LibrarySymbol} from './lib/ffi/LibrarySymbol'

/**
 * FFI Interfaces
 */
export * from './lib/ffi/interfaces/IRegisteredCallback'
export * from './lib/ffi/interfaces/ICType'
export * from './lib/ffi/interfaces/ILib'
export * from './lib/ffi/interfaces/IPointerCast'

/**
 * FFI types
 */
export * from './lib/ffi/types/ArrayHint'
export * from './lib/ffi/types/LibFunc'
export * from './lib/ffi/types/LibFunction'
export * from './lib/ffi/types/PrimitiveKind'
export * from './lib/ffi/types/TypeInfo'
export * from './lib/ffi/types/TypeSpec'
export * from './lib/ffi/types/TypeSpecWithAlignment'

/**
 * FFI Exceptions
 */
export * from './exceptions/LibraryUnloadedException'

/**
 * FFI Provider
 */
export class FFIProvider extends Provider {

    /**
     * Library path
     */
    @Configurable(DTO.String().required())
    public readonly lib: string

    #library: Library

    /**
     * Initializer
     * @protected
     */
    protected async init(): Promise<void> {
        this.#library = new Library(this.lib)
        const offset = this.#library.symbol('offset', 'int')
        offset.value = 8
        const func = this.#library.func('uint64_t factorial(int max)')
        console.log('ffi test:', func(3), offset.value)
    }

    /**
     * Destroyer
     * @protected
     */
    protected async destroy(): Promise<void> {
        this.#library.destroy()
    }
}
