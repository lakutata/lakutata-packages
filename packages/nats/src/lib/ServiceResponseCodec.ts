import {Exception} from 'lakutata'
import {ServiceInvokeException} from '../exceptions/ServiceInvokeException'

interface ServiceResponse {
    readonly success: boolean
    readonly error: Error | Exception | null
    readonly payload: any | null
}

export class ServiceResponseCodec {
    /**
     * Encode service response
     * @param data
     * @param isError
     */
    public static encode(data: any, isError: boolean): ServiceResponse {
        return isError ? {
            success: false,
            error: data,
            payload: null
        } : {
            success: true,
            error: null,
            payload: data
        }
    }

    /**
     * Decode service response
     * @param response
     * @param serviceId
     */
    public static decode(response: ServiceResponse, serviceId?: string): any {
        if (!response.success) {
            const remoteError: any = response.error
            const serviceInvokeException: ServiceInvokeException = new ServiceInvokeException(remoteError?.message || 'Unknown Error')
            if (serviceId) serviceInvokeException.service = serviceId
            // 安全拷贝远端错误的自有属性:逐个赋值并跳过只读属性(如 NatsError 的 name),
            // 避免 Object.assign 碰到只读属性时整体抛 TypeError。
            if (remoteError && typeof remoteError === 'object') {
                for (const key of Object.keys(remoteError)) {
                    try {
                        (serviceInvokeException as any)[key] = remoteError[key]
                    } catch {
                        // 只读属性,跳过
                    }
                }
            }
            throw serviceInvokeException
        }
        return response.payload
    }
}