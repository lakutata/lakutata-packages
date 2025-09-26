import {Exception} from 'lakutata'

export class NatsRequestTimeoutException extends Exception {
    public errno: string | number = 'E_NATS_REQUEST_TIMEOUT'
    public message: string = 'Request Timeout'
    public statusCode: number = 408
}