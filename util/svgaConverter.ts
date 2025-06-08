import type {BitmapsCache, Video} from "svga/dist/types";
import {render} from 'svga';
import upng from "upng-js";

const {encode} = upng;

export class SVGAConverter {
    private video: Video;
    private ofsCanvas: HTMLCanvasElement | OffscreenCanvas;
    private bitmapsCache: BitmapsCache = {};

    constructor(video: Video) {
        this.video = video;
        this.ofsCanvas = window.OffscreenCanvas !== undefined ? new window.OffscreenCanvas(video.size.width, video.size.height) : document.createElement('canvas')
    }

    async load() {
        return await new Promise<void>((resolve, reject) => {
            let totalCount = 0
            let loadedCount = 0
            for (const key in this.video.images) {
                const image = this.video.images[key]
                if (typeof image === 'string') {
                    totalCount++
                    const img = document.createElement('img')
                    img.src = 'data:image/png;base64,' + image
                    this.bitmapsCache[key] = img
                    img.onload = () => {
                        loadedCount++
                        loadedCount === totalCount && resolve()
                    }
                } else {
                    this.bitmapsCache[key] = image
                    totalCount++
                    loadedCount++
                    loadedCount === totalCount && resolve()
                }
            }
        })
    }

    convertToAPNG(): Blob {
        if (this.video === undefined) throw new Error('videoEntity undefined')
        let arrayBuffList: ArrayBuffer[] = []
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', {
            willReadFrequently: true,
            alpha: true,
            desynchronized: true,
        })! as CanvasRenderingContext2D
        canvas.width = this.video.size.width
        canvas.height = this.video.size.height
        for (let i = 0; i < this.video.frames - 1; i++) {
            const img = this.getTargetFrame(i)
            if (img instanceof ImageData) {
                arrayBuffList.push(img.data.buffer)
            } else {
                canvas.width = this.video.size.width
                ctx.drawImage(img, 0, 0)
                const buff = ctx.getImageData(0, 0, this.video.size.width, this.video.size.height).data.buffer
                arrayBuffList.push(buff)
                img.close()
            }
        }

        const delayList = Array.from({length: arrayBuffList.length}, () => {
            return Math.round(1000 / this.video.fps) // Convert to milliseconds
        })
        const pngFile = encode(
            arrayBuffList,
            this.video.size.width,
            this.video.size.height,
            0,
            delayList
        ) as ArrayBuffer
        arrayBuffList = null as any

        return new Blob([pngFile], {
            type: 'image/vnd.mozilla.apng',
        })
    }

    destruct() {
        this.video = null as any;
        this.ofsCanvas = null as any;
        this.bitmapsCache = {};
    }

    private getTargetFrame(target: number): ImageData | ImageBitmap {
        if (this.video === undefined) throw new Error('videoEntity undefined')
        if (target < 0 || target > this.video.frames - 2) throw "Invalid target frame";
        let ofsCanvas = this.ofsCanvas

        // OffscreenCanvas 在 Firefox 浏览器无法被清理历史内容
        if (window.OffscreenCanvas !== undefined && window.navigator.userAgent.includes('Firefox')) {
            ofsCanvas = new window.OffscreenCanvas(this.video.size.width, this.video.size.height)
        }

        ofsCanvas.width = this.video.size.width
        ofsCanvas.height = this.video.size.height

        render(
            ofsCanvas,
            this.bitmapsCache,
            this.video.dynamicElements,
            this.video.replaceElements,
            this.video,
            target
        )

        if ('toDataURL' in ofsCanvas) {
            let ctx = ofsCanvas.getContext("2d")
            return ctx!.getImageData(0, 0, this.video.size.width, this.video.size.height)
        } else {
            return ofsCanvas.transferToImageBitmap()
        }
    }
}
