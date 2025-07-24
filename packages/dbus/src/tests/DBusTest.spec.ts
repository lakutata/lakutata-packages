import {Application} from 'lakutata'
import {Logger} from 'lakutata/com/logger'
import {DevNull} from 'lakutata/helper'
import {buildDBusClientOptions} from '../providers/DBusClientProvider'
import {Test} from './Test'

Application.run({
    id: 'dbus.test',
    name: 'DBusTest',
    providers: {
        client: buildDBusClientOptions({
            busAddress: 'tcp:host=192.168.1.127,port=44444'
        })
    },
    components: {
        test: {
            class: Test
        }
    },
    bootstrap: [
        'test'
    ]
})
    .onLaunched((app: Application, logger: Logger) => logger.info('The application %s has successfully started in %s mode.', app.appName, app.mode()))
    .onFatalException((error: Error, logger: Logger): void => logger.error('A fatal error occurred in the program: %s', error.message))
    .onUncaughtException((error: Error & any, logger: Logger): void => error.code === 'EPIPE' ? DevNull(error) : logger.error('UncaughtError occurred: %s', error.message))