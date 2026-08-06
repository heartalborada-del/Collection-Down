import pako from 'pako'

export type EncodeMessage = {
    type: 'encode'
    frames: ArrayBuffer[]
    width: number
    height: number
    delayList: number[]
}

export type WorkerResponse =
    | { type: 'success'; pngFile: ArrayBuffer }
    | { type: 'error'; error?: string }

type UPNGWorkerGlobal = DedicatedWorkerGlobalScope & {
    window: DedicatedWorkerGlobalScope
    pako: typeof pako
}

const ctx = self as unknown as UPNGWorkerGlobal

// upng-js 2.x uses a legacy UMD wrapper that falls back to window.pako.
// A production web worker has neither window nor require, so expose the
// worker global under the names expected by UPNG before loading the module.
ctx.window = ctx
ctx.pako = pako

const encodePromise = import('upng-js').then(({ encode }) => encode)

ctx.onmessage = async (event: MessageEvent<EncodeMessage>) => {
    if (event.data?.type !== 'encode') return

    try {
        const { frames, width, height, delayList } = event.data
        const encode = await encodePromise
        const pngFile = encode(frames, width, height, 0, delayList) as ArrayBuffer
        ctx.postMessage({ type: 'success', pngFile }, [pngFile])
    } catch (err: unknown) {
        ctx.postMessage({ type: 'error', error: err instanceof Error ? err.message : 'UPNG encode failed' })
    }
}

export { }
