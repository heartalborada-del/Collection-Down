import { DEFAULT_DOWNLOAD_TASK_OPTIONS, DownloadTask, type DownloadTaskOptions } from "./task";
import type { DownloadItem } from "./types";


/**
 * 下载器配置：控制并发数与单任务配置。
 */
export type DownloaderOptions = {
    /** 最大并发下载数（至少会被修正为 1） */
    maxConcurrentDownloads: number;
    /** 传递给 DownloadTask 的配置 */
    taskOptions?: DownloadTaskOptions;
}

/**
 * 默认下载器配置。
 */
export const DEFAULT_DOWNLOADER_OPTIONS: DownloaderOptions = {
    maxConcurrentDownloads: 3,
    taskOptions: DEFAULT_DOWNLOAD_TASK_OPTIONS,
}

/**
 * 下载管理器：
 * - 维护任务队列
 * - 按并发限制启动下载
 * - 支持统一取消
 */
export class Downloader {
    /** 等待下载的任务队列（先进先出） */
    private queue: DownloadItem[] = [];
    /** 当前正在下载的任务数量 */
    private currentDownloads: number = 0;
    /** 当前活跃的下载实例，用于取消时统一 shutdown */
    private downloadInstances: DownloadTask[] = [];
    /** 防止重复调用 startDownloads 导致重复启动 worker */
    private isRunning: boolean = false;

    constructor(private readonly options?: DownloaderOptions) { }

    /** 添加单个下载任务到队列 */
    public addDownload(item: DownloadItem) {
        this.queue.push(item);
    }

    /** 批量添加下载任务 */
    public addDownloads(items: DownloadItem[]) {
        items.forEach(item => this.addDownload(item));
    }

    /**
     * 启动下载流程：
     * 1. 根据配置计算并发 worker 数
     * 2. 每个 worker 循环从队列取任务并执行
     * 3. 全部 worker 结束后退出
     */
    public async startDownloads() {
        // 已在运行时直接返回，避免重复启动。
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        const options = this.options ?? DEFAULT_DOWNLOADER_OPTIONS;
        // 并发数兜底为 >= 1 的整数。
        const concurrency = Math.max(1, Math.floor(options.maxConcurrentDownloads || 1));
        // worker 数不需要超过队列长度。
        const workerCount = Math.min(concurrency, this.queue.length);

        try {
            const workers = Array.from({ length: workerCount }, () => this.startNextDownload());
            await Promise.all(workers);
        } finally {
            // 无论成功或失败都要重置运行状态。
            this.isRunning = false;
        }
    }

    /**
     * 取消全部下载：
     * - 关闭所有活跃任务
     * - 清空剩余队列
     */
    public cancelAllDownloads() {
        this.downloadInstances.forEach(instance => instance.shutdown()); // 调用每个下载实例的取消方法
        this.queue = []; // 清空队列
    }

    /**
     * worker 主循环：持续从队列中取任务并下载，直到队列为空。
     */
    private async startNextDownload() {
        const options = this.options ?? DEFAULT_DOWNLOADER_OPTIONS;
        while (this.queue.length > 0) {
            const task = this.queue.shift()!; // 获取下一个下载任务
            const currentInstance = new DownloadTask(task, options.taskOptions);
            this.downloadInstances.push(currentInstance);
            this.currentDownloads++; // 增加当前下载数
            try {
                // 下载成功后转为 Blob，回调给业务层。
                const data = await currentInstance.download();
                const blob = new Blob([data as unknown as BlobPart])
                task.OnSuccess?.(blob);
            } catch (error) {
                // 下载失败时把错误抛给任务失败回调。
                task.OnFailed?.(error);
            } finally {
                this.currentDownloads--; // 结束下载任务时减少当前下载数
                // 从活跃实例列表中移除当前任务。
                this.downloadInstances = this.downloadInstances.filter(instance => instance !== currentInstance);
            }
        }
    }
}