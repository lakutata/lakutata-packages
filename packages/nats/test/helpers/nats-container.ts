import {GenericContainer, StartedTestContainer, Wait} from 'testcontainers'

export interface StartedNats {
    /** host:port 形式的连接地址 */
    url: string
    /** 停止并移除容器 */
    stop: () => Promise<void>
}

/**
 * 用本地 Docker 启动一个临时 NATS 服务器。
 * 随机映射端口、等待 "Server is ready" 日志、用完自动销毁。
 */
export async function startNatsContainer(): Promise<StartedNats> {
    // 用 2.12(贴近生产部署)而非 2.10:2.10 对 stream config 宽容、会接受多余的 `replicas` 字段,
    // 反而掩盖 bug;2.12 严格校验未知字段(unknown field "replicas"),能守住 replicas 回归。
    const container: StartedTestContainer = await new GenericContainer('nats:2.12-alpine')
        .withExposedPorts(4222)
        .withCommand(['-js']) // 启用 JetStream(bulk 旁路的 Object Store 需要)
        .withWaitStrategy(Wait.forLogMessage(/Server is ready/))
        .start()
    const url: string = `${container.getHost()}:${container.getMappedPort(4222)}`
    return {
        url,
        stop: async (): Promise<void> => {
            await container.stop()
        }
    }
}
