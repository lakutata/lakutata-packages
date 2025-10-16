import {Exception} from 'lakutata'

export class ServiceInvokeException extends Exception {
    public errno: string | number = 'E_SERVICE_INVOKE'
}