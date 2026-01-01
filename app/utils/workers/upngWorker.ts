import upng from 'upng-js'

const { encode } = upng

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

const ctx = self as unknown as DedicatedWorkerGlobalScope

ctx.onmessage = (event: MessageEvent<EncodeMessage>) => {
    if (event.data?.type !== 'encode') return

    try {
        const { frames, width, height, delayList } = event.data
        const pngFile = encode(frames, width, height, 0, delayList) as ArrayBuffer
        ctx.postMessage({ type: 'success', pngFile }, [pngFile])
    } catch (err: any) {
        ctx.postMessage({ type: 'error', error: err?.message || 'UPNG encode failed' })
    }
}

export { }
