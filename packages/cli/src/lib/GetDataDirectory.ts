import path from 'node:path'

export function GetDataDirectory(): string {
    return path.resolve(__dirname, '../../node_modules/.data')
}