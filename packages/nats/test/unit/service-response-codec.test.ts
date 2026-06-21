import {describe, expect, test} from 'bun:test'
import {ServiceResponseCodec} from '../../src/lib/ServiceResponseCodec'
import {ServiceInvokeException} from '../../src/CommonExports'

describe('ServiceResponseCodec', (): void => {

    test('encode 成功响应:{success:true, error:null, payload}', (): void => {
        expect(ServiceResponseCodec.encode({a: 1}, false)).toEqual({success: true, error: null, payload: {a: 1}})
    })

    test('encode 错误响应:{success:false, error, payload:null}', (): void => {
        const err: any = {message: 'boom', errno: 'X', statusCode: 500}
        expect(ServiceResponseCodec.encode(err, true)).toEqual({success: false, error: err, payload: null})
    })

    test('decode 成功响应返回 payload', (): void => {
        const r = ServiceResponseCodec.encode({a: 1}, false)
        expect(ServiceResponseCodec.decode(r)).toEqual({a: 1})
    })

    test('decode 错误响应抛 ServiceInvokeException,携带 serviceId 与原始错误字段', (): void => {
        const r = ServiceResponseCodec.encode({message: 'boom', errno: 'X_ERR', statusCode: 503}, true)
        let caught: any
        try {
            ServiceResponseCodec.decode(r, 'svc.id')
        } catch (e) {
            caught = e
        }
        expect(caught).toBeInstanceOf(ServiceInvokeException)
        expect(caught.message).toBe('boom')
        expect(caught.service).toBe('svc.id')
        expect(caught.errno).toBe('X_ERR')      // Object.assign 用远端字段覆盖默认 errno
        expect(caught.statusCode).toBe(503)
    })

    test('decode 错误响应:无 message 回退 Unknown Error;无 serviceId 时 service 不设置', (): void => {
        const r = ServiceResponseCodec.encode({}, true)
        let caught: any
        try {
            ServiceResponseCodec.decode(r)
        } catch (e) {
            caught = e
        }
        expect(caught).toBeInstanceOf(ServiceInvokeException)
        expect(caught.message).toBe('Unknown Error')
        expect(caught.errno).toBe('E_SERVICE_INVOKE') // 未被远端字段覆盖,保留默认
        expect(caught.service).toBeUndefined()
    })
})
