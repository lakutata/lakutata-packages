import {Application, ApplicationOptions} from 'lakutata'
import {FFIProvider} from '../FFIProvider'

Application.run(async (): Promise<ApplicationOptions> => ({
    id: 'test.ffi.lakutata.app',
    name: 'Lakutata FFI test',
    providers: {
        ffi: {
            class: FFIProvider,
            lib: '/Users/alex/libfactorial.dylib'
        }
    },
    bootstrap: [async (m) => {
        const ffi = m.getObject<FFIProvider>('ffi')
    }]
}))
