import {Provider} from 'lakutata'
import {Configurable} from 'lakutata/decorator/di'
import {gt as isVersionGreaterThan, prerelease} from 'semver'

export class OnlineLatestVersion extends Provider {

    @Configurable()
    protected readonly version: string

    @Configurable()
    protected readonly name: string

    /**
     * Get package name
     */
    public getName(): string {
        return this.name
    }

    /**
     * Get latest version
     */
    public async getVersion(): Promise<string> {
        let onlineLatestVersion: string
        const prereleaseInfo: ReadonlyArray<string | number> | null = prerelease(this.version)
        const latestVersionPackage = await import('latest-version')
        if (prereleaseInfo && prereleaseInfo[0]) {
            // onlineLatestVersion = await require('latest-version').default(this.name, {version: prereleaseInfo[0].toString()})
            onlineLatestVersion = await latestVersionPackage.default(this.name, {version: prereleaseInfo[0].toString()})
        } else {
            // onlineLatestVersion = await require('latest-version').default(this.name)
            onlineLatestVersion = await latestVersionPackage.default(this.name)
        }
        return isVersionGreaterThan(onlineLatestVersion, this.version) ? onlineLatestVersion : this.version
    }

}
