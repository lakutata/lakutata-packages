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
            const remoteError: Error | Exception = response.error!
            const serviceInvokeException: ServiceInvokeException = new ServiceInvokeException(remoteError.message || 'Unknown Error')
            if (serviceId) serviceInvokeException.service = serviceId
            throw Object.assign(serviceInvokeException, response.error!)
        }
        return response.payload
    }
}