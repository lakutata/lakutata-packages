import {GetDataDirectory} from './GetDataDirectory'
import path from 'node:path'

export function GetLocalDataFilename(): string {
    return path.resolve(GetDataDirectory(), 'templates.db')
}