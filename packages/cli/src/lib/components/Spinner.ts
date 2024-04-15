import {type Spinner as CliSpinner, dots} from 'cli-spinners'
import {Configurable, Singleton} from 'lakutata/decorator/di'
import {Component} from 'lakutata'

const logUpdate = require('log-update')

@Singleton()
export class Spinner extends Component {

    @Configurable()
    protected readonly style: CliSpinner = dots

    protected spinnerInterval: NodeJS.Timeout | null = null

    /**
     * Start spinner
     * @param description
     */
    public start(description?: string | (() => string)): void {
        this.stop()
        let i: number = 0
        this.spinnerInterval = setInterval(() => {
            const {frames} = this.style
            const text: string = description ? `${frames[i = ++i % frames.length]} ${typeof description === 'function' ? description() : description}` : frames[i = ++i % frames.length]
            logUpdate(text)
        }, dots.interval)
    }

    /**
     * Stop spinner
     */
    public stop(): void {
        if (this.spinnerInterval) {
            clearInterval(this.spinnerInterval)
            this.spinnerInterval = null
            logUpdate.clear()
        }
    }
}
