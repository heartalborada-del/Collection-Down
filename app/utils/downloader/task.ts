import { DownloaderErrorEnum, DownloadError } from "~/utils/downloader/errors";
import { MutexRW } from "mutex-ts";
import type { DownloadItem } from "./types";

export type DownloadTaskOptions = {
    maxThreads: number;
    chunkSize: number;
}

export const DEFAULT_DOWNLOAD_TASK_OPTIONS: DownloadTaskOptions = {
    maxThreads: 4,
    chunkSize: 1024 * 1024, // 1 MB
}

export class DownloadTask {
    private readonly mutex = new MutexRW();
    private bytebuffer: Uint8Array = new Uint8Array(0);
    private readonly shutdownSignal = new AbortController()

    // 新增类级别的进度/文件大小字段，供各 chunk 流式更新使用
    private downloaded: number = 0;
    private fileSize: number = -1;

    constructor(private item: DownloadItem, private options?: DownloadTaskOptions) { }

    /**
     * Get the size of the file to be downloaded.
     * <code>-1</code> if the size cannot be determined.
     * @param url
     * @private
     */
    private async getFileSize(url: string): Promise<number> {
        const response = await fetch(url, { method: 'HEAD', signal: this.shutdownSignal.signal });
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
        this.fileSize = fileSize; // 保存到类字段
        this.downloaded = 0; // 初始化为 0

        if (fileSize === -1) {
            // Fallback to single-threaded download
            const response = await fetch(this.item.Url);
            if (!response.ok) {
                throw new DownloadError(DownloaderErrorEnum.NetworkError);
            }
            const data = new Uint8Array(await response.arrayBuffer());
            // 保存到任务状态，确保 OnProgress 与内部状态一致
            this.bytebuffer = data;
            this.fileSize = data.length;
            this.downloaded = data.length;
            this.item.OnProgress?.(this.downloaded, this.fileSize);
            return data;
        }
        const maxThreads = options.maxThreads;
        let currentThreadCount = 0, index = 0;
        this.bytebuffer = new Uint8Array(fileSize);

        const afterChuckComplete = async (_start: number, _end: number) => {
            // 不再在这里累计 downloaded（stream 已经在 downloadChunk 中实时更新）
            // 仅负责调度下一个 chunk
            if (this.downloaded < this.fileSize) {
                const RW = await this.mutex.obtainRW();
                let nextStart = 0, nextEnd = 0;
                let hasNext = false;
                try {
                    nextStart = index * options.chunkSize;
                    if (nextStart >= this.fileSize) {
                    } else {
                        nextEnd = Math.min(nextStart + options.chunkSize - 1, this.fileSize - 1);
                        index += 1;
                        hasNext = true;
                    }
                } finally {
                    RW();
                }
                if (hasNext) {
                    this.downloadChunk(this.item.Url, nextStart, nextEnd).then(() => {
                        afterChuckComplete(nextStart, nextEnd);
                    });
                }
            }
        }

        while (currentThreadCount < maxThreads) {
            // 在持锁期间计算并捕获 start/end，避免在释放锁后被其他线程修改导致重复或重叠分片
            const RW = await this.mutex.obtainRW();
            let start = 0, end = 0;
            let shouldBreak = false;
            try {
                start = index * options.chunkSize;
                if (start >= fileSize) {
                    shouldBreak = true;
                } else {
                    end = Math.min(start + options.chunkSize - 1, fileSize - 1);
                    index += 1;
                    currentThreadCount += 1;
                }
            } finally {
                RW();
            }
            if (shouldBreak) break;
            await this.downloadChunk(this.item.Url, start, end).then(() => {
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

        // 使用流式读取，边读边写入 bytebuffer，并在每次写入后更新 progress
        const reader = response.body?.getReader();
        if (!reader) {
            // 退回到一次性读取的逻辑（兼容性）
            const data = new Uint8Array(await response.arrayBuffer());
            const RW = await this.mutex.obtainRW()
            try {
                this.bytebuffer.set(data, start);
                // 更新已下载字节并通知
                this.downloaded += data.length;
            } finally {
                RW();
            }
            this.item.OnProgress?.(this.downloaded, this.fileSize);
            return true;
        }

        let writePos = start;
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value && value.length > 0) {
                    const RW = await this.mutex.obtainRW();
                    try {
                        // 写入缓冲区
                        this.bytebuffer.set(value, writePos);
                        writePos += value.length;
                        // 更新全局已下载字节数
                        this.downloaded += value.length;
                    } finally {
                        RW();
                    }
                    // 在释放锁之后触发进度回调
                    this.item.OnProgress?.(this.downloaded, this.fileSize);
                }
            }
        } catch (e) {
            // 如果是中断导致的异常，向上抛出或按需忽略
            throw e;
        }

        return true;
    }
}