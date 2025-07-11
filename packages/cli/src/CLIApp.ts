#!/usr/bin/env node

import * as console from 'node:console'
import path from 'node:path'
import {ListTemplateNames} from './lib/ListTemplateNames'
import process from 'node:process'

const dataDir: string = path.resolve(__dirname, '../node_modules/.data')
const localDataFilename: string = path.resolve(dataDir, 'templates.db')
ListTemplateNames(localDataFilename).then(async (templateNames: string[]): Promise<void> => {
    process.env.LAKUTATA_TEMPLATE_NAMES = JSON.stringify(templateNames)
    const {Config} = require('./config/Config')
    const {Application} = await import('lakutata')
    Application
        .alias({
            '@packageJson': path.resolve(__dirname, '../package.json'),
            '@data': dataDir,
            '@localDataFilename': localDataFilename
        }, true)
        .env({
            LAKUTATA_TEMPLATE_NAMES: JSON.stringify(templateNames)
        })
        .run(Config)
        .onUncaughtException((error: Error) => {
            console.error(`error: ${error.message}`)
            return process.exit(1)
        })
}).catch((): void => process.exit(1))
