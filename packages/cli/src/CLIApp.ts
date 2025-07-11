#!/usr/bin/env node

import {GetDataDirectory} from './lib/GetDataDirectory'
import path from 'node:path'
import * as console from 'node:console'
import process from 'node:process'
import {Application} from 'lakutata'
import {Config} from './config/Config'

Application
    .alias({
        '@packageJson': path.resolve(__dirname, '../package.json'),
        '@data': GetDataDirectory()
    }, true)
    .run(Config)
    .onUncaughtException((error: Error) => {
        console.error(`error: ${error.message}`)
        return process.exit(1)
    })