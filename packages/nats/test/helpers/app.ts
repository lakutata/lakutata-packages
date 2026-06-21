import {Application, ApplicationOptions} from 'lakutata'

/**
 * 启动一个 lakutata 应用,并在 onLaunched 时解析出 app 实例。
 * 返回的 app 提供 getObject();测试结束时用 destroyApp(app) 清理。
 */
export function runApp(options: ApplicationOptions): Promise<Application> {
    return new Promise<Application>((resolve, reject) => {
        Application.run(options)
            .onLaunched(async (app: Application): Promise<void> => {
                resolve(app)
            })
            .onUncaughtException((error: Error): void => {
                reject(error)
            })
    })
}

/**
 * 销毁测试 app。必须用 destroy() 而不是 app.exit():
 * exit() 内部会调用 process.exit(),在 bun test 进程里会杀掉测试运行器,
 * 导致结果汇总来不及打印(现象是 "0 tests")。
 * destroy() 级联销毁所有对象(包括关闭 NATS 连接)但不退出进程。
 */
export async function destroyApp(app: Application): Promise<void> {
    await (app as unknown as {destroy: () => Promise<void>}).destroy()
}
