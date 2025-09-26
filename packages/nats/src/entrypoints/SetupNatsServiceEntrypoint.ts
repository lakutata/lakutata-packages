import {
    BuildServiceEntrypoint,
    ServiceContext,
    ServiceEntrypoint,
    ServiceEntrypointHandler
} from 'lakutata/com/entrypoint'
import {Application, Module} from 'lakutata'
import {NATS} from '../components/NATS'

/**
 * Setup service based on NATS
 * @param natsComponentName
 * @constructor
 */
export function SetupNatsServiceEntrypoint(natsComponentName: string): ServiceEntrypoint {
    return BuildServiceEntrypoint(async (module: Module, handler: ServiceEntrypointHandler) => {
        const nats: NATS = await module.getObject<NATS>(natsComponentName)
        nats.subscribe((module as Application).appId, async (incomeRequestPayload: any) => {
            return await handler(new ServiceContext({
                data: incomeRequestPayload
            }))
        })
    })
}