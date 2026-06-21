import {describe, expect, test} from 'bun:test'
import {Codec} from 'nats'
import {JSONCodec, MessagePackCodec} from '../../src/CommonExports'

// 两个 codec 共享同一组不变量:内部都先经 JSON 清洗 + [d] 数组包裹,
// 故对特殊值(undefined / Date / BigInt)的行为应一致,差别仅在二进制格式。
const codecs: Array<{name: string; make: () => Codec<any>}> = [
    {name: 'MessagePackCodec', make: MessagePackCodec},
    {name: 'JSONCodec', make: JSONCodec}
]

for (const {name, make} of codecs) {
    describe(name, (): void => {
        const codec: Codec<any> = make()

        test('对象/数组/嵌套结构 round-trip 保持一致', (): void => {
            const v = {hello: 'bun', n: 1, flag: true, arr: [1, 2, {a: true}], nested: {x: {y: 'z'}}}
            expect(codec.decode(codec.encode(v))).toEqual(v)
        })

        test('原始值 round-trip', (): void => {
            expect(codec.decode(codec.encode('hi'))).toBe('hi')
            expect(codec.decode(codec.encode(42))).toBe(42)
            expect(codec.decode(codec.encode(true))).toBe(true)
            expect(codec.decode(codec.encode(null))).toBeNull()
        })

        test('encode 产出字节序列(Uint8Array)', (): void => {
            expect(codec.encode({a: 1})).toBeInstanceOf(Uint8Array)
        })

        test('undefined 经 JSON 清洗后变为 null', (): void => {
            expect(codec.decode(codec.encode(undefined))).toBeNull()
        })

        test('Date 被序列化为 ISO 字符串(JSON 语义,非 Date 对象)', (): void => {
            const d = new Date('2020-01-01T00:00:00.000Z')
            expect(codec.decode(codec.encode(d))).toBe('2020-01-01T00:00:00.000Z')
        })

        test('BigInt 无法编码(JSON.stringify 抛 TypeError)', (): void => {
            expect((): Uint8Array => codec.encode(10n)).toThrow(TypeError)
        })
    })
}
