import {PrototypeInfo} from './PrototypeInfo'

export type LibFunction = {
    (...args: any[]): any;
    async: (...args: any[]) => any;
    info: PrototypeInfo;
}
