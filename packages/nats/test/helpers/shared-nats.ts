import {startNatsContainer, StartedNats} from './nats-container'

// NATS 容器接入点(每个测试进程内的懒加载单例)。
//
// lakutata 一个进程只能有一个 Application(全局 @runtime alias),而 bun test 把
// 同一目录下的多个测试文件跑在同一进程里 —— 所以集成测试由 test/run-integration.ts
// 编排:容器只起一次,各 integration 文件用独立子进程运行,通过 NATS_URL 共享同一 NATS。
//
// 因此这里:若环境已提供 NATS_URL(被编排器注入),直接复用,不再起新容器;
// 否则(单独 `bun test <file>` 跑某个文件时)自行启动一个容器。
let started: Promise<StartedNats> | undefined

export function ensureNats(): Promise<StartedNats> {
    if (!started) {
        const external: string | undefined = process.env.NATS_URL
        if (external) {
            started = Promise.resolve({url: external, stop: async (): Promise<void> => {}})
        } else {
            started = startNatsContainer().then((nats: StartedNats): StartedNats => {
                process.env.NATS_URL = nats.url
                return nats
            })
        }
    }
    return started
}

export async function stopNats(): Promise<void> {
    if (started) {
        const nats: StartedNats = await started
        await nats.stop()
        started = undefined
    }
}
