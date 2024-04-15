import {Exception} from 'lakutata'

export class LibraryUnloadedException extends Exception {
    public errno: string | number = 'E_LIBRARY_UNLOADED'
}
