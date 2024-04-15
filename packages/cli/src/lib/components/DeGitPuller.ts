import degit from 'degit'
import {Configurable, Singleton} from 'lakutata/decorator/di'
import {Component, DTO} from 'lakutata'


@Singleton()
export class DeGitPuller extends Component {

    @Configurable(DTO.Boolean().optional().default(false))
    protected readonly cache: boolean = false

    @Configurable(DTO.Boolean().optional().default(true))
    protected readonly verbose: boolean = true

    @Configurable(DTO.Boolean().optional().default(true))
    protected readonly force: boolean = true

    @Configurable(DTO.String().required())
    protected readonly repo: string

    /**
     * get git source
     * @param branch
     */
    public getGitSource(branch: string): string {
        return `${this.repo}#${branch}`
    }

    /**
     * Exec pull
     * @param branch
     * @param localTarget
     */
    public async pull(branch: string, localTarget: string): Promise<void> {
        await degit(this.getGitSource(branch), {
            cache: this.cache,
            verbose: this.verbose,
            force: this.force
        }).clone(localTarget)
    }
}
