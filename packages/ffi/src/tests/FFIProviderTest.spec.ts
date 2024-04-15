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
        const ffi = await m.getObject<FFIProvider>('ffi')
        const offset = ffi.symbol('offset', 'int')
        offset.value = 8
        const func = ffi.func('uint64_t factorial(int max)')
        console.log('ffi test:', func(3), offset.value)
    }]
}))
