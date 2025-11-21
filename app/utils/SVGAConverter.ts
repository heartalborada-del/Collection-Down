import type {Video} from "svga/src/types";
import upng from "upng-js";
import {Player} from "svga/src/index";

const {encode} = upng;

export class SVGAConverter {
    private readonly player: Player
    private readonly resolution: {width: number, height: number}
    private readonly frameCnt: number
    private readonly fps: number

    constructor(private readonly video: Video) {
        this.player = new Player({});
        this.resolution = {width: video.size.width, height: video.size.height}
        this.frameCnt = video.frames
        this.fps = video.fps
    }
    
    async convertToAPNG(): Promise<Blob> {
        await this.player.mount(this.video)
        const arrayBuffList: ArrayBuffer[] = this.player.getAllFrames();
        
        const delayList = Array.from({length: arrayBuffList.length}, () => {
            return Math.round(1000 / this.fps) // Convert to milliseconds
        })

        const pngFile = encode(
            arrayBuffList,
            this.resolution.width,
            this.resolution.height,
            0,
            delayList
        ) as ArrayBuffer

        return new Blob([pngFile], {
            type: 'image/apng',
        })
    }
}