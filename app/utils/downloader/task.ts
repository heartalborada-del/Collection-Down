import { DownloaderErrorEnum, DownloadError } from "~/utils/downloader/errors";
import type { DownloadItem } from "./types";

export type DownloadTaskOptions = {
    maxThreads: number;
    chunkSize: number;
    // 分块失败的最大重试次数（每个分块单独计数）
    maxRetries?: number;
    // 重试的基础退避时间（毫秒），指数退避：base * 2^attempt
    retryBaseDelayMs?: number;
    EdgeOneCompatible?: boolean; // 是否启用针对 EdgeOne 的兼容性调整
}

export const DEFAULT_DOWNLOAD_TASK_OPTIONS: DownloadTaskOptions = {
    maxThreads: 4,
    chunkSize: 1024 * 1024, // 1 MB
    maxRetries: 2,
    retryBaseDelayMs: 300,
    EdgeOneCompatible: false,
}

export class DownloadTask {
    // 预分配的目标缓冲区
    private bytebuffer: Uint8Array = new Uint8Array(0);
    // 统一的取消信号（供外部取消，内部所有 fetch 共享）
    private readonly shutdownSignal = new AbortController();

    // 进度/总大小，供外部 UI 监听
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
        // 使用 HEAD 探测是否支持 Range 下载与内容长度
        const response = await fetch(url, { method: 'HEAD', signal: this.shutdownSignal.signal, cache: 'no-store' });
        if (!response.ok || response.headers.get('Accept-Ranges')?.toLowerCase() !== 'bytes')
            return -1;
        let contentLength = response.headers.get('Content-Length');
        if (this.options?.EdgeOneCompatible) {
            // EdgeOne 兼容：优先使用备份的原始 Content-Length
            const backupLength = response.headers.get('X-Length-Backup');
            if (backupLength) {
                contentLength = backupLength;
            }
        }
        return contentLength ? parseInt(contentLength, 10) : -1;
    }

    private sleep(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Start the download task.
     * @constructor
     */
    public async download(): Promise<Uint8Array> {
        const options = this.options ?? DEFAULT_DOWNLOAD_TASK_OPTIONS;
        const fileSize = await this.getFileSize(this.item.Url);
        this.fileSize = fileSize;
        this.downloaded = 0;

        // 不支持 Range 或无法获知大小：退回单连接下载。
        if (fileSize === -1) {
            const response = await fetch(this.item.Url, { signal: this.shutdownSignal.signal, cache: 'no-store' });
            if (!response.ok) {
                throw new DownloadError(DownloaderErrorEnum.NetworkError);
            }
            const data = new Uint8Array(await response.arrayBuffer());
            this.bytebuffer = data;
            this.fileSize = data.length;
            this.downloaded = data.length;
            this.item.OnProgress?.(this.downloaded, this.fileSize);
            return data;
        }

        // 支持 Range：构建分块任务并通过简单任务池并发执行。
        this.bytebuffer = new Uint8Array(fileSize);
        const ranges: Array<{ start: number; end: number }> = [];
        for (let start = 0; start < fileSize; start += options.chunkSize) {
            const end = Math.min(start + options.chunkSize - 1, fileSize - 1);
            ranges.push({ start, end });
        }

        // 简单任务池：限制同时进行的分块请求数
        const limit = Math.max(1, options.maxThreads);
        let idx = 0;
        const workers = new Array(Math.min(limit, ranges.length)).fill(0).map(async () => {
            while (true) {
                const current = idx++;
                if (current >= ranges.length) break;
                const { start, end } = ranges[current]!;
                await this.downloadChunk(this.item.Url, start, end);
            }
        });
        await Promise.all(workers);
        return this.bytebuffer;
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
        const options = this.options ?? DEFAULT_DOWNLOAD_TASK_OPTIONS;
        const maxRetries = options.maxRetries ?? DEFAULT_DOWNLOAD_TASK_OPTIONS.maxRetries!;
        const baseDelay = options.retryBaseDelayMs ?? DEFAULT_DOWNLOAD_TASK_OPTIONS.retryBaseDelayMs!;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            let addedThisAttempt = 0; // 本次尝试期间已计入的进度，失败需回滚
            try {
                const response = await fetch(url, {
                    headers: { 'Range': `bytes=${start}-${end}` },
                    signal: this.shutdownSignal.signal,
                    cache: 'no-store',
                });
                if (!response.ok) {
                    throw new DownloadError(DownloaderErrorEnum.NetworkError);
                }

                const reader = response.body?.getReader();
                if (!reader) {
                    // 环境不支持 ReadableStream：一次性读取
                    const data = new Uint8Array(await response.arrayBuffer());
                    this.bytebuffer.set(data, start);
                    this.downloaded += data.length;
                    this.item.OnProgress?.(this.downloaded, this.fileSize);
                    return true;
                }

                let writePos = start;
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (value && value.length > 0) {
                        this.bytebuffer.set(value, writePos);
                        writePos += value.length;
                        this.downloaded += value.length;
                        addedThisAttempt += value.length;
                        this.item.OnProgress?.(this.downloaded, this.fileSize);
                    }
                }
                return true; // 分块成功完成
            } catch (e: any) {
                // 如果是主动取消，直接抛出终止
                const name = e?.name || e?.constructor?.name;
                if (name === 'AbortError') throw e;

                // 回滚本次尝试期间累加的进度，避免重试导致进度超量
                if (addedThisAttempt > 0) {
                    this.downloaded = Math.max(0, this.downloaded - addedThisAttempt);
                    this.item.OnProgress?.(this.downloaded, this.fileSize);
                }

                if (attempt < maxRetries) {
                    const delay = baseDelay * Math.pow(2, attempt);
                    await this.sleep(delay);
                    continue;
                }
                throw new DownloadError(DownloaderErrorEnum.NetworkError);
            }
        }
        return false;
    }
}