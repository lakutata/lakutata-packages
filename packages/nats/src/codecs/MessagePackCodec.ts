import {Codec} from 'nats'
import {MessagePack} from 'lakutata/helper'

export function MessagePackCodec(): Codec<any> {
    return {
        encode(d: any): Uint8Array {
            return MessagePack.encode([d])
        },
        decode(a: Uint8Array): any {
            const [res] = MessagePack.decode(a)
            return res
        }
    }
}