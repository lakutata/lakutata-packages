import {
    BuildServiceEntrypoint,
    ServiceContext,
    ServiceEntrypoint,
    ServiceEntrypointHandler
} from 'lakutata/com/entrypoint'
import {Application, Module} from 'lakutata'
import {NATS} from '../components/NATS'
import {ServiceResponseCodec} from '../lib/ServiceResponseCodec'

/**
 * 把异常拷成可序列化的普通对象(保留 message/errno/statusCode 等自有属性)。
 * @param error
 */
function toErrorObject(error: any): Record<string, any> {
    const errorObject: Record<string, any> = {}
    Object.getOwnPropertyNames(error).forEach((prop: string) => errorObject[prop] = error[prop])
    return errorObject
}

/**
 * Setup service based on NATS
 * @param natsComponentName
 * @constructor
 */
export function SetupNatsServiceEntrypoint(natsComponentName: string): ServiceEntrypoint {
    return BuildServiceEntrypoint(async (module: Module, handler: ServiceEntrypointHandler) => {
        const nats: NATS = await module.getObject<NATS>(natsComponentName)
        const appId: string = (module as Application).appId
        nats.subscribe(appId, async (incomeRequestPayload: any) => {
            try {
                return ServiceResponseCodec.encode(await handler(new ServiceContext({
                    data: incomeRequestPayload
                })), false)
            } catch (e: any) {
                return ServiceResponseCodec.encode(toErrorObject(e), true)
            }
        }, {
            queue: `${appId}.serviceQueue`,
            // 入站 decode 失败 / 出站 encode 失败等发生在 handler 之外(subscribe 层)的错误,
            // 由此工厂统一回成标准失败响应,避免请求方挂到超时。
            errorResponse: (e: any) => ServiceResponseCodec.encode(toErrorObject(e), true)
        })
    })
}