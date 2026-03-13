import { DEFAULT_DOWNLOAD_TASK_OPTIONS, DownloadTask, type DownloadTaskOptions } from "./task";
import type { DownloadItem } from "./types";


export type DownloaderOptions = {
    maxConcurrentDownloads: number;
    taskOptions?: DownloadTaskOptions;
}

export const DEFAULT_DOWNLOADER_OPTIONS: DownloaderOptions = {
    maxConcurrentDownloads: 3,
    taskOptions: DEFAULT_DOWNLOAD_TASK_OPTIONS,
}

export class Downloader {
    private queue: DownloadItem[] = []; // Task queue
    private currentDownloads: number = 0;
    private downloadInstances: DownloadTask[] = [];
    private isRunning: boolean = false;

    constructor(private readonly options?: DownloaderOptions) { }

    public addDownload(item: DownloadItem) {
        this.queue.push(item);
    }

    public addDownloads(items: DownloadItem[]) {
        items.forEach(item => this.addDownload(item));
    }

    public async startDownloads() {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        const options = this.options ?? DEFAULT_DOWNLOADER_OPTIONS;
        const concurrency = Math.max(1, Math.floor(options.maxConcurrentDownloads || 1));
        const workerCount = Math.min(concurrency, this.queue.length);

        try {
            const workers = Array.from({ length: workerCount }, () => this.startNextDownload());
            await Promise.all(workers);
        } finally {
            this.isRunning = false;
        }
    }

    public cancelAllDownloads() {
        this.downloadInstances.forEach(instance => instance.shutdown()); // 调用每个下载实例的取消方法
        this.queue = []; // 清空队列
    }

    private async startNextDownload() {
        const options = this.options ?? DEFAULT_DOWNLOADER_OPTIONS;
        while (this.queue.length > 0) {
            const task = this.queue.shift()!; // 获取下一个下载任务
            const currentInstance = new DownloadTask(task, options.taskOptions);
            this.downloadInstances.push(currentInstance);
            this.currentDownloads++; // 增加当前下载数
            try {
                const data = await currentInstance.download();
                const blob = new Blob([data as unknown as BlobPart])
                task.OnSuccess?.(blob);
            } catch (error) {
                task.OnFailed?.(error);
            } finally {
                this.currentDownloads--; // 结束下载任务时减少当前下载数
                this.downloadInstances = this.downloadInstances.filter(instance => instance !== currentInstance);
            }
        }
    }
}