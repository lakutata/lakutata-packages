import {Exception} from 'lakutata'

/**
 * bulk 中转层故障(Object Store put/get 失败、引用过期取不到、bulk 未启用等)。
 * 表示"大数据通道出问题",区别于业务错误;不应自动重试(响应取不到时对侧可能已处理)。
 * message 由抛出处给出具体原因(不设默认值,以保留原因)。
 */
export class NatsBulkException extends Exception {
    public errno: string | number = 'E_NATS_BULK'
    public statusCode: number = 502
}
