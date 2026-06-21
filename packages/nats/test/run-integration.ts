import {readdirSync} from 'node:fs'
import {join} from 'node:path'
import {startNatsContainer, StartedNats} from './helpers/nats-container'

// 集成测试编排器:
// lakutata 一进程一个 Application,而 bun test 同进程跑多文件 —— 多个文件各起 app 会
// 因全局 @runtime alias 冲突。这里改为:启动一个共享 NATS 容器,然后逐个 integration
// 文件用独立 `bun test` 子进程运行(每个进程一个 app),通过 NATS_URL 共享同一 NATS。
async function main(): Promise<void> {
    const dir: string = 'test/integration'
    const files: string[] = readdirSync(dir).filter((f: string): boolean => f.endsWith('.test.ts')).sort()

    const nats: StartedNats = await startNatsContainer()
    let failed: boolean = false
    try {
        for (const file of files) {
            console.log(`\n=== integration: ${file} ===`)
            const proc = Bun.spawnSync(['bun', 'test', join(dir, file)], {
                env: {...process.env, NATS_URL: nats.url},
                stdout: 'inherit',
                stderr: 'inherit'
            })
            if (proc.exitCode !== 0) failed = true
        }
    } finally {
        await nats.stop()
    }
    process.exit(failed ? 1 : 0)
}

void main()
