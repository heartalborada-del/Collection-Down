import type {DownloadItem} from "./types";
import {DownloaderErrorEnum, DownloadError} from "~/utils/downloader/errors";
import {MutexRW} from "mutex-ts";

export type DownloaderOptions = {
    maxConcurrentDownloads: number;
    taskOptions?: DownloadTaskOptions;
}

export class Downloader {
    private queue: {
        task: DownloadItem,
        resolve: (blob: Blob) => void,
        reject: (error: any) => void
    }[] = []; // Task queue
    private currentDownloads: number = 0;
    private downloadInstances: DownloadTask[] = [];

    constructor(private readonly maxConcurrentDownloads: number, private readonly options?: DownloaderOptions) {}

    public addDownload(task: DownloadItem): Promise<Blob> {
        return new Promise<Blob>((resolve, reject) => {
            this.queue.push({
                task: task,
                resolve: resolve,
                reject: reject
            });
            this.startNextDownload();
        })
    }

    public cancelAllDownloads() {
        this.downloadInstances.forEach(instance => instance.shutdown()); // 调用每个下载实例的取消方法
        this.queue = []; // 清空队列
    }

    private async startNextDownload() {
        while (this.currentDownloads < this.maxConcurrentDownloads && this.queue.length > 0) {
            const task = this.queue.shift()!; // 获取下一个下载任务
            const downloadManager = new DownloadTask(task.task, this.options?.taskOptions);
            this.downloadInstances.push(downloadManager);
            this.currentDownloads++; // 增加当前下载数
            try {
                const data = await downloadManager.download();
                task.resolve(new Blob([data as unknown as BlobPart]));
            } catch (error) {
                task.reject(error);
            } finally {
                this.currentDownloads--; // 结束下载任务时减少当前下载数
                this.downloadInstances = this.downloadInstances.filter(instance => instance !== downloadManager);
                this.startNextDownload(); // 启动下一个下载
            }
        }
    }
}

export type DownloadTaskOptions = {
    maxThreads: number;
    chunkSize: number;
}

const DEFAULT_DOWNLOAD_TASK_OPTIONS: DownloadTaskOptions = {
    maxThreads: 4,
    chunkSize: 1024 * 1024, // 1 MB
}

export class DownloadTask {
    private readonly mutex = new MutexRW();
    private bytebuffer: Uint8Array = new Uint8Array(0);
    private readonly shutdownSignal = new AbortController()

    constructor(private item: DownloadItem, private options?: DownloadTaskOptions) {}

    /**
     * Get the size of the file to be downloaded.
     * <code>-1</code> if the size cannot be determined.
     * @param url
     * @private
     */
    private async getFileSize(url: string): Promise<number> {
        const response = await fetch(url, {method: 'HEAD',signal: this.shutdownSignal.signal});
        if (!response.ok || response.headers.get('Accept-Ranges')?.toLowerCase() !== 'bytes')
            return -1;
        const contentLength = response.headers.get('Content-Length');
        return contentLength ? parseInt(contentLength, 10) : -1;
    }

    /**
     * Start the download task.
     * @constructor
     */
    public async download(): Promise<Uint8Array> {
        const options = this.options ?? DEFAULT_DOWNLOAD_TASK_OPTIONS;
        const fileSize = await this.getFileSize(this.item.Url);
        if (fileSize === -1) {
            // Fallback to single-threaded download
            const response = await fetch(this.item.Url);
            if (!response.ok) {
                throw new DownloadError(DownloaderErrorEnum.NetworkError);
            }
            const data = new Uint8Array(await response.arrayBuffer());
            this.item.OnProgress?.(data.length, data.length);
            return data;
        }
        const maxThreads = options.maxThreads;
        let currentThreadCount = 0,index = 0;
        this.bytebuffer = new Uint8Array(fileSize);
        let downloaded = 0;
        const afterChuckComplete = async (start:number,end:number) => {
            const RO = await this.mutex.obtainRO()
            downloaded += end - start + 1;
            this.item.OnProgress?.(downloaded, this.bytebuffer.length);
            RO()
            if (downloaded < fileSize) {
                const RO = await this.mutex.obtainRW();
                const nextStart = index * options.chunkSize;
                if (nextStart>=fileSize) {
                    RO();
                    return;
                }
                const nextEnd = Math.min(nextStart + options.chunkSize - 1, fileSize - 1);
                index += 1;
                RO()
                this.downloadChunk(this.item.Url, nextStart, nextEnd).then(() => {
                    afterChuckComplete(nextStart, nextEnd);
                });
            }
        }
        while (currentThreadCount < maxThreads) {
            const start = index * options.chunkSize, end = Math.min(start + options.chunkSize - 1, fileSize - 1);
            if (start>=fileSize) break;
            const RO = await this.mutex.obtainRO()
            currentThreadCount += 1;
            index += 1;
            RO();
            this.downloadChunk(this.item.Url, start, end).then(() => {
                afterChuckComplete(start, end);
            })
        }
        return this.bytebuffer
    }

    /**
     * Will throw an error, just ignore it
     * @constructor
     */
    public shutdown(): boolean {
        this.shutdownSignal.abort("Shutdown requested");
        return true;
    }

    /**
     * Download a chunk of the file.
     * @param url
     * @param start
     * @param end
     * @private
     */
    private async downloadChunk(url: string, start: number, end: number): Promise<boolean> {
        const response = await fetch(url, {
            headers: {
                'Range': `bytes=${start}-${end}`
            },
            signal: this.shutdownSignal.signal
        });
        if (!response.ok) {
            throw new DownloadError(DownloaderErrorEnum.NetworkError);
        }
        const data = new Uint8Array(await response.arrayBuffer());
        const RW = await this.mutex.obtainRW()
        try {
            this.bytebuffer.set(data, start);
        } catch {
            // ignore
        } finally {
            RW();
        }
        return true;
    }
}