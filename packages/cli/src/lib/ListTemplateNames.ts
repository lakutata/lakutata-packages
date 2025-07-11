import {Time} from 'lakutata'
import * as fs from 'node:fs'
import {GetLocalDataFilename} from './GetLocalDataFilename'

export function ListTemplateNames(): string[] {
    const localDataFilename: string = GetLocalDataFilename()
    const isLocalDataExists: boolean = fs.existsSync(localDataFilename)
    let cache: Record<string, any> = {
        templates: [],
        updatedAt: Time.now()
    }
    if (isLocalDataExists) {
        cache = JSON.parse(fs.readFileSync(localDataFilename, {encoding: 'utf-8'}))
    }
    if (!cache) return []
    return cache.templates!.map((template: any): string => template.name)
}