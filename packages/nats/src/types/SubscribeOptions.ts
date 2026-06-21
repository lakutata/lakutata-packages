export type SubscribeOptions = {
    queue?: string
    max?: number
    iterator?: boolean
    /**
     * 当消息处理出错且该消息是请求(带 reply 地址)时,用此工厂生成回传给请求方的 payload。
     * subscribe 会用当前 codec 编码它并 respond;返回 undefined 则不回响应(请求方靠超时感知)。
     * 用于让上层(如服务入口)注入自己的错误响应协议,而不让通用 subscribe 依赖该协议。
     */
    errorResponse?: (error: any) => any
}