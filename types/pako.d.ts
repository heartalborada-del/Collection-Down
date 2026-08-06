declare module 'pako' {
    export interface PakoOptions {
        [key: string]: unknown
    }

    export function deflate(data: ArrayBuffer | Uint8Array, options?: PakoOptions): Uint8Array
    export function inflate(data: ArrayBuffer | Uint8Array, options?: PakoOptions): Uint8Array

    const pako: {
        deflate: typeof deflate
        inflate: typeof inflate
    }

    export default pako
}
