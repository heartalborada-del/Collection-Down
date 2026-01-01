import { Player } from "@heartalborada-del/svga";
import type { Video } from "@heartalborada-del/svga/dist/types";

export class SVGAConverter {
    private readonly player: Player
    private readonly resolution: { width: number, height: number }
    private readonly frameCnt: number
    private readonly fps: number

    constructor(private readonly video: Video) {
        this.player = new Player({});
        this.resolution = { width: video.size.width, height: video.size.height }
        this.frameCnt = video.frames
        this.fps = video.fps
    }

    async convertToAPNG(): Promise<Blob> {
        await this.player.mount(this.video)
        const arrayBuffList: ArrayBuffer[] = this.player.getAllFrames();
        const delayList = Array.from({ length: arrayBuffList.length }, () => {
            return Math.round(1000 / this.fps) // Convert to milliseconds
        })

        const pngFile = await this.encodeWithWorker(arrayBuffList, delayList)

        return new Blob([pngFile], {
            type: 'image/apng',
        })
    }

    private encodeWithWorker(frames: ArrayBuffer[], delayList: number[]): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const worker = new Worker(new URL('./workers/upngWorker.ts', import.meta.url), { type: 'module' })

            worker.onmessage = (event) => {
                const result = event.data as { type: 'success', pngFile: ArrayBuffer } | { type: 'error', error?: string }
                if (result.type === 'success') {
                    resolve(result.pngFile)
                } else {
                    reject(new Error(result.error || 'UPNG encode failed'))
                }
                worker.terminate()
            }

            worker.onerror = (err) => {
                reject(err.error ?? new Error(err.message))
                worker.terminate()
            }

            worker.postMessage(
                {
                    type: 'encode',
                    frames,
                    width: this.resolution.width,
                    height: this.resolution.height,
                    delayList,
                },
                frames
            )
        })
    }
}