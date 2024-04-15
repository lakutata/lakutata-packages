import {PrimitiveKind} from './PrimitiveKind'
import {ArrayHint} from './ArrayHint'
import {PrototypeInfo} from './PrototypeInfo'

export type TypeInfo = {
    name: string;
    primitive: PrimitiveKind;
    size: number;
    alignment: number;
    disposable: boolean;
    length?: number;
    hint?: ArrayHint;
    ref?: TypeInfo;
    members?: Record<string, { name: string, type: TypeInfo, offset: number }>;
    proto?: PrototypeInfo
}
