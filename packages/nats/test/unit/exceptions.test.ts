import {describe, expect, test} from 'bun:test'
import {Exception} from 'lakutata'
import {
    NatsBadRequestException,
    NatsForbiddenException,
    NatsInternalServerException,
    NatsNoRespondersAvailableException,
    NatsNotFoundException,
    NatsRequestTimeoutException,
    ServiceInvokeException,
    NatsBulkException
} from '../../src/CommonExports'

const cases: Array<{Cls: new (msg?: string) => any; errno: string; message: string; statusCode: number}> = [
    {Cls: NatsBadRequestException, errno: 'E_NATS_BAD_REQUEST', message: 'Bad Request', statusCode: 400},
    {Cls: NatsForbiddenException, errno: 'E_NATS_FORBIDDEN', message: 'Forbidden', statusCode: 403},
    {Cls: NatsNotFoundException, errno: 'E_NATS_NOT_FOUND', message: 'Subject Not Found', statusCode: 404},
    {Cls: NatsRequestTimeoutException, errno: 'E_NATS_REQUEST_TIMEOUT', message: 'Request Timeout', statusCode: 408},
    {Cls: NatsInternalServerException, errno: 'E_NATS_INTERNAL_SERVER', message: 'Internal Server Error', statusCode: 500},
    {Cls: NatsNoRespondersAvailableException, errno: 'E_NATS_NO_RESPONDERS_AVAILABLE', message: 'No Responders Available', statusCode: 503}
]

describe('Nats*Exception', (): void => {
    for (const {Cls, errno, message, statusCode} of cases) {
        test(`${Cls.name}: errno/message/statusCode 正确且为 Exception/Error 实例`, (): void => {
            const e = new Cls()
            expect(e).toBeInstanceOf(Exception)
            expect(e).toBeInstanceOf(Error)
            expect(e.errno).toBe(errno)
            expect(e.message).toBe(message)
            expect(e.statusCode).toBe(statusCode)
        })
    }

    test('构造参数不覆盖类内置 message(默认 message 在构造后才赋值)', (): void => {
        expect(new NatsForbiddenException('whatever').message).toBe('Forbidden')
    })
})

describe('ServiceInvokeException', (): void => {
    test('默认 errno、可选 service 字段,message 取自构造参数', (): void => {
        const e = new ServiceInvokeException('boom')
        expect(e).toBeInstanceOf(Exception)
        expect(e.errno).toBe('E_SERVICE_INVOKE')
        expect(e.message).toBe('boom')
        expect(e.service).toBeUndefined()
    })
})

describe('NatsBulkException', (): void => {
    test('errno/statusCode + 构造 message,且非 NoResponders(故不会被 #7 自动重试)', (): void => {
        const e = new NatsBulkException('bulk get failed')
        expect(e).toBeInstanceOf(Exception)
        expect(e.errno).toBe('E_NATS_BULK')
        expect(e.statusCode).toBe(502)
        expect(e.message).toBe('bulk get failed') // 不设默认 message → 构造参数生效
        expect(e).not.toBeInstanceOf(NatsNoRespondersAvailableException) // 不会被自动重试
    })
})
