import {type Spinner as CliSpinner, dots} from 'cli-spinners'
import {Configurable, Singleton} from 'lakutata/decorator/di'
import {Component} from 'lakutata'

@Singleton()
export class Spinner extends Component {

    @Configurable()
    protected readonly style: CliSpinner = dots

    protected spinnerInterval: NodeJS.Timeout | null = null

    protected logUpdate: any

    /**
     * Initializer
     * @protected
     */
    protected async init(): Promise<void> {
        const lu = await import('log-update')
        this.logUpdate = lu.default
    }

    /**
     * Start spinner
     * @param description
     */
    public start(description?: string | (() => string)): void {
        this.stop()
        let i: number = 0
        this.spinnerInterval = setInterval((): void => {
            const {frames} = this.style
            const text: string = description ? `${frames[i = ++i % frames.length]} ${typeof description === 'function' ? description() : description}` : frames[i = ++i % frames.length]
            this.logUpdate(text)
        }, dots.interval)
    }

    /**
     * Stop spinner
     */
    public stop(): void {
        if (this.spinnerInterval) {
            clearInterval(this.spinnerInterval)
            this.spinnerInterval = null
            this.logUpdate.clear()
        }
    }
}
