#!/usr/bin/env node

import {Application} from 'lakutata'
import * as console from 'node:console'
import path from 'node:path'
import {Config} from './config/Config'

Application
    .alias({
        '@packageJson': path.resolve(__dirname, '../package.json'),
        '@data': path.resolve(__dirname, '../node_modules/.data')
    }, true)
    .run(Config)
    .onUncaughtException((error: Error) => {
        console.error(`error: ${error.message}`)
        return process.exit(1)
    })
