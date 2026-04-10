import { DownloadTask, type DownloadTaskOptions } from "./task";
import type { DownloadItem } from "./types";
import { ZipWriter, BlobWriter } from "@zip.js/zip.js";

/**
 * 下载器配置：控制并发数与单任务分片配置。
 */
export type DownloaderOptions = {
    /** 最大并发下载数 */
    maxConcurrentDownloads: number;
    /** 传递给 DownloadTask 的配置 */
    taskOptions: DownloadTaskOptions;
}

export const DEFAULT_DOWNLOADER_OPTIONS: DownloaderOptions = {
    maxConcurrentDownloads: 3,
    taskOptions: {
        maxThreads: 3,
        chunkSize: 1024 * 1024 * 2 // 2MB per chunk
    },
}

/**
 * 新版下载分块队列管理管理器：
 * - 维护任务队列，包含打入 Zip 的动作
 * - 按并发限制启动下载
 * - 支持全局统一取消
 */
export class Downloader {
    /** 等待下载的任务队列 */
    private queue: DownloadItem[] = [];
    /** 正在执行的任务实例列表 */
    private downloadInstances: DownloadTask[] = [];
    private isRunning: boolean = false;
    private blobWriter: BlobWriter | null = new BlobWriter("application/zip");
    private zipWriter: ZipWriter<Blob> | null;
    private finish: boolean = false;
    constructor(private readonly options: DownloaderOptions = DEFAULT_DOWNLOADER_OPTIONS) {
        this.zipWriter = new ZipWriter<Blob>(this.blobWriter!);
    }

    /** 添加单个下载任务到队列 */
    public addDownload(item: DownloadItem) {
        this.queue.push(item);
    }

    /** 批量添加下载任务 */
    public addDownloads(items: DownloadItem[]) {
        items.forEach(item => this.addDownload(item));
    }

    /** 直接混入本地原始数据到最终的 Zip 中 */
    public async addRawData(fileDirectory: string, blob: Blob) {
        if (!this.zipWriter) throw new Error("ZipWriter is already closed or not initialized.");
        await this.zipWriter.add(fileDirectory, blob.stream());
    }

    /**
     * 启动下载流程
     */
    public async startDownloads() {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;

        const o = this.options;
        const concurrency = Math.max(1, Math.floor(o.maxConcurrentDownloads || 1));
        const workerCount = Math.min(concurrency, this.queue.length);

        try {
            const workers = Array.from({ length: workerCount }, () => this.startNextDownload());
            await Promise.all(workers);
        } finally {
            this.isRunning = false;
            this.finish = true;
        }
    }

    /**
     * 将下载的内容保存为 Zip Blob，并彻底关闭 writer。
     * 你可以在该方法返回后，将其转为 BlobUrl 给用户下载。
     */
    public async save(): Promise<Blob | null> {
        if (this.finish && this.zipWriter && this.blobWriter) {
            await this.zipWriter.close();
            const blob = await this.blobWriter.getData();
            this.blobWriter = null;
            this.zipWriter = null;
            return blob;
        }
        return null;
    }

    /**
     *  检查是否所有下载任务都已完成（无论成功或失败）。如果队列为空且没有活跃任务，则认为完成。
     */
    public isFinish(): boolean {
        return this.finish;
    }

    /**
     * 取消全部下载：
     * - 关闭所有活跃任务
     * - 清空剩余队列
     */
    public cancelAllDownloads() {
        this.downloadInstances.forEach(instance => instance.shutdown());
        this.queue = [];
    }

    /**
     * worker 主循环：持续从队列中取任务并下载流打入 zip
     */
    private async startNextDownload() {
        const o = this.options;
        while (this.queue.length > 0) {
            const taskItem = this.queue.shift()!;

            if (!this.zipWriter) throw new Error("ZipWriter is already closed or not initialized.");

            const taskOpts = {
                ...o.taskOptions,
                onProgress: taskItem.OnProgress
            };

            const task = new DownloadTask(
                this.zipWriter,
                taskItem.FileFullDirectory,
                taskItem.Url,
                taskOpts
            );

            this.downloadInstances.push(task);

            try {
                await task.download();
                taskItem.OnSuccess?.();
            } catch (error) {
                taskItem.OnFailed?.(error);
            } finally {
                // 从活跃任务队列中移除自己
                const idx = this.downloadInstances.indexOf(task);
                if (idx !== -1) {
                    this.downloadInstances.splice(idx, 1);
                }
            }
        }
    }
}

