import {Component} from 'lakutata'
import * as console from 'node:console'
import {Inject} from 'lakutata/decorator/di'
import {DBusClientProvider} from '../providers/DBusClientProvider'
import {DBusSignalEmitter} from 'dbus-sdk'

export class Test extends Component {

    @Inject('client')
    protected readonly dbus: DBusClientProvider

    @Inject('client', async (dbusClient: DBusClientProvider): Promise<DBusSignalEmitter> => (await dbusClient.interface('org.ptswitch.pad', '/', 'org.freedesktop.DBus.Properties')).signal)
    // @Inject('client',async (dbusClient:DBusClient)=>dbusClient.uniqueName)
    protected readonly padServPropSignal: DBusSignalEmitter

    // protected readonly client: DBusService

    protected async init(): Promise<void> {
        const serv = await this.dbus.service('org.ptswitch.pad')
        const obj = await serv.getObject('/slot1/port1/stc')
        const iface = await obj.getInterface('pad.stc')
        // iface.method.xxx()
        console.log(JSON.stringify(iface.listMethods(), null, 2))
        // const obj=await this.client.getObject('/')
        // const inf=await obj.getInterface('org.freedesktop.DBus.Properties')
        this.padServPropSignal.on('PropertiesChanged', async (a, b, c) => {
            const serv = await this.dbus.service('org.ptswitch.pad')
            console.log(await serv.listObjects())
        })
        console.log('hello!!!')
        // console.log(this.client)
        // setInterval(async () => {
        //     try {
        //         const objs = await this.client.getObjects()
        //         console.log(objs.map(obj => obj.name))
        //     } catch (e: any) {
        //         console.warn(e.message)
        //     }
        // }, 1000)
        // this.dbus.on('')
    }
}