import {describe, expect, test} from 'bun:test'
import {ServiceEventCodec} from '../../src/lib/ServiceEventCodec'

describe('ServiceEventCodec', (): void => {

    test('encode/decode 往返保持参数数组', (): void => {
        const args = [1, 'a', {x: true}, [2, 3]]
        expect(ServiceEventCodec.decode(ServiceEventCodec.encode(args))).toEqual(args)
    })

    test('encode 产出 {args}', (): void => {
        expect(ServiceEventCodec.encode([1, 2])).toEqual({args: [1, 2]})
    })

    test('formatSubject 确定且带框架前缀', (): void => {
        const s = ServiceEventCodec.formatSubject('svc', 'evt')
        expect(s).toBe(ServiceEventCodec.formatSubject('svc', 'evt'))
        expect(s.startsWith('framework.internal.service.event.')).toBe(true)
    })

    test('formatSubject 对不同 serviceId / eventName 产出不同 subject', (): void => {
        const base = ServiceEventCodec.formatSubject('svc', 'evt')
        expect(ServiceEventCodec.formatSubject('svc', 'evt2')).not.toBe(base)
        expect(ServiceEventCodec.formatSubject('svc2', 'evt')).not.toBe(base)
    })
})
