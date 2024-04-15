import {TypeSpec} from '../types/TypeSpec'
import {LibFunction} from '../types/LibFunction'

export interface ILib {
    func(definition: string): LibFunction;

    func(name: string, result: TypeSpec, args: TypeSpec[]): LibFunction;

    func(convention: string, name: string, result: TypeSpec, args: TypeSpec[]): LibFunction;

    symbol(name: string, type: TypeSpec): any;

    unload(): void;
}
