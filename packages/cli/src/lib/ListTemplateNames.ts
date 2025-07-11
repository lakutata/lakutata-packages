import {IsExists} from 'lakutata/helper'
import {Time} from 'lakutata'
import {readFile} from 'node:fs/promises'

export async function ListTemplateNames(localDataFilename: string): Promise<string[]> {
    const isLocalDataExists: boolean = await IsExists(localDataFilename)
    let cache: Record<string, any> = {
        templates: [],
        updatedAt: Time.now()
    }
    if (isLocalDataExists) {
        cache = JSON.parse(await readFile(localDataFilename, {encoding: 'utf-8'}))
    }
    if (!cache) return []
    return cache.templates!.map(template => template.name)
}