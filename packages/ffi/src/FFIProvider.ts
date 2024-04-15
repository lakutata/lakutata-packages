import {DTO, Provider} from 'lakutata'
import {Configurable} from 'lakutata/decorator/di'
import 'reflect-metadata'
import {Library} from './lib/ffi/Library'
import {LibFunction} from './lib/ffi/types/LibFunction'
import {TypeSpec} from './lib/ffi/types/TypeSpec'
import {LibrarySymbol} from './lib/ffi/LibrarySymbol'

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
    }

    /**
     * Destroyer
     * @protected
     */
    protected async destroy(): Promise<void> {
        this.#library.destroy()
    }

    /**
     * library symbol
     * @param name
     * @param type
     */
    public symbol(name: string, type: TypeSpec): LibrarySymbol {
        return this.#library.symbol(name, type)
    }

    /**
     * Declare function in the library
     * @param definition
     */
    public func(definition: string): LibFunction
    /**
     * Declare function in the library
     * @param name
     * @param result
     * @param args
     */
    public func(name: string, result: TypeSpec, args: TypeSpec[]): LibFunction
    public func(nameOrDefinition: string, result?: TypeSpec, args?: TypeSpec[]): LibFunction {
        if (result && args) {
            return this.cdeclFunc(nameOrDefinition, result, args)
        } else {
            return this.cdeclFunc(nameOrDefinition)
        }
    }

    /**
     * Cdecl
     * This is the default convention, and the only one on other platforms
     * @param definition
     */
    public cdeclFunc(definition: string): LibFunction
    /**
     * Cdecl
     * This is the default convention, and the only one on other platforms
     * @param name
     * @param result
     * @param args
     */
    public cdeclFunc(name: string, result: TypeSpec, args: TypeSpec[]): LibFunction
    public cdeclFunc(nameOrDefinition: string, result?: TypeSpec, args?: TypeSpec[]): LibFunction {
        if (result && args) {
            return this.#library.func(nameOrDefinition, result, args)
        } else {
            return this.#library.func(nameOrDefinition)
        }
    }

    /**
     * Stdcall
     * This convention is used extensively within the Win32 API
     * @param name
     * @param result
     * @param args
     */
    public sdtcallFunc(name: string, result: TypeSpec, args: TypeSpec[]): LibFunction {
        return this.#library.sdtcallFunc(name, result, args)
    }

    /**
     * Fastcall
     * Rarely used, uses ECX and EDX for first two parameters
     * @param name
     * @param result
     * @param args
     */
    public fastcallFunc(name: string, result: TypeSpec, args: TypeSpec[]): LibFunction {
        return this.#library.fastcallFunc(name, result, args)
    }

    /**
     * Thiscall
     * Rarely used, uses ECX for first parameter
     * @param name
     * @param result
     * @param args
     */
    public thiscallFunc(name: string, result: TypeSpec, args: TypeSpec[]): LibFunction {
        return this.#library.thiscallFunc(name, result, args)
    }
}
