import {
    BuildServiceEntrypoint,
    ServiceContext,
    ServiceEntrypoint,
    ServiceEntrypointHandler
} from 'lakutata/com/entrypoint'
import {Application, Module} from 'lakutata'
import {NATS} from '../components/NATS'
import {ServiceResponseCodec} from '../lib/ServiceResponseCodec'

/**
 * Setup service based on NATS
 * @param natsComponentName
 * @constructor
 */
export function SetupNatsServiceEntrypoint(natsComponentName: string): ServiceEntrypoint {
    return BuildServiceEntrypoint(async (module: Module, handler: ServiceEntrypointHandler) => {
        const nats: NATS = await module.getObject<NATS>(natsComponentName)
        nats.subscribe((module as Application).appId, async (incomeRequestPayload: any) => {
            try {
                return ServiceResponseCodec.encode(await handler(new ServiceContext({
                    data: incomeRequestPayload
                })), false)
            } catch (e: any) {
                const errorObject: Record<string, any> = {}
                Object.getOwnPropertyNames(e).forEach((prop: string) => errorObject[prop] = e[prop])
                return ServiceResponseCodec.encode(errorObject, true)
            }
        }, {queue: `${(module as Application).appId}.serviceQueue`})
    })
}