export interface ReturnData {
    blob: Blob,
    type: string
}

interface DownloadTask {
    url: string;
    threadCount: number;
    onProgress?: (downloadedBytes: number, totalBytes: number) => void;
}

export class DownloadInstance {
    private readonly url: string;
    private readonly threadCount: number;
    private readonly onProgress?: (downloadedBytes: number, totalBytes: number) => void;
    private downloadedBytes: number = 0; // 当前下载的字节数
    private canceled: boolean = false; // 下载是否被取消
    private hasErrorOccurred: boolean = false; // 是否发生错误
    private succeeded: boolean = true;
    private blobResult: Blob | null = null; // 存储下载的 Blob

    constructor(task: DownloadTask) {
        this.url = task.url;
        this.threadCount = task.threadCount;
        this.onProgress = task.onProgress;
    }

    public cancel() {
        this.canceled = true;
    }

    public isCanceled() {
        return this.canceled
    }

    public isStopped() {
        return this.canceled || this.hasErrorOccurred || this.succeeded
    }

    public isSucceeded() {
        return this.succeeded
    }

    public async start(): Promise<ReturnData> {
        try {
            return await this.download();
        } catch (err) {
            if (this.canceled) {
                throw new Error('Download was canceled');
            } else {
                throw err;
            }
        }
    }

    private async supportsRange(): Promise<boolean> {
        const response = await fetch(this.url, {method: 'HEAD'});
        return response.headers.get('Accept-Ranges') === 'bytes';
    }

    private async download(): Promise<ReturnData> {
        if (await this.supportsRange() && this.threadCount > 1) {
            const response = await fetch(this.url, {method: 'HEAD'});
            if (!response.ok) return Promise.reject(new Error(`Failed to fetch file: ${response.statusText}`));

            const contentLength = Number(response.headers.get('Content-Length'));
            const totalChunks = Math.ceil(contentLength / (contentLength / this.threadCount));
            const fileData = new Uint8Array(contentLength);
            const promises: Promise<void>[] = [];
            let ongoingRequests = 0;

            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                const start = Math.floor((chunkIndex / totalChunks) * contentLength);
                const end = Math.min(Math.floor(((chunkIndex + 1) / totalChunks) * contentLength), contentLength);

                const fetchChunk = async () => {
                    ongoingRequests++;
                    try {
                        const chunkResponse = await fetch(this.url, {headers: {Range: `bytes=${start}-${end - 1}`}});
                        let reader = chunkResponse.body?.getReader();
                        if (!chunkResponse.ok || !reader) throw new Error(`Failed to fetch chunk: ${chunkResponse.statusText}`);

                        while (true) {
                            const {done, value} = await reader.read();
                            if (done) break;

                            fileData.set(value, this.downloadedBytes); // 更新文件数据
                            this.downloadedBytes += value.length; // 更新已下载字节数


                            // 调用进度回调
                            if (this.onProgress && !this.canceled && !this.hasErrorOccurred) {
                                this.onProgress(this.downloadedBytes, contentLength); // 报告当前下载的字节数和总字节数
                            }

                            // 检查是否被取消或发生错误
                            if (this.canceled || this.hasErrorOccurred) {
                                throw new Error('Download canceled or an error occurred');
                            }
                        }
                    } catch (error) {
                        this.hasErrorOccurred = true; // 设置错误状态
                        throw error; // 抛出错误以终止下载
                    } finally {
                        ongoingRequests--;
                    }
                };

                promises.push(fetchChunk());
                if (ongoingRequests >= this.threadCount) {
                    await Promise.race(promises);
                    promises.filter(p => p !== Promise.race(promises));
                }

                // 检查是否被取消或发生错误
                if (this.canceled || this.hasErrorOccurred) {
                    throw new Error('Download canceled or an error occurred');
                }
            }
            await Promise.all(promises);
            this.succeeded = true
            this.blobResult = new Blob([fileData]);
            return {
                blob: this.blobResult,
                type: response.headers.get('Content-Type') || ''
            };
        } else {
            const response = await fetch(this.url);
            const contentLength = Number(response.headers.get('Content-Length'));
            const fileData = new Uint8Array(contentLength);
            let reader = response.body?.getReader();
            if (!response.ok || !reader) return Promise.reject(new Error(`Failed to fetch file: ${response.statusText}`));
            while (true) {
                const {done, value} = await reader.read();

                if (done) break;

                fileData.set(value, this.downloadedBytes); // 更新文件数据
                this.downloadedBytes += value.length; // 更新已下载字节数

                // 调用进度回调
                if (this.onProgress && !this.canceled && !this.hasErrorOccurred) {
                    this.onProgress(this.downloadedBytes, contentLength); // 报告当前下载的字节数和总字节数
                }

                // 检查是否被取消或发生错误
                if (this.canceled || this.hasErrorOccurred) {
                    throw new Error('Download canceled or an error occurred');
                }
            }
            this.blobResult = new Blob([fileData]);
            return {
                blob: this.blobResult,
                type: response.headers.get('Content-Type') || ''
            };
        }
    }
}

export class Downloader {
    private queue: {
        task: DownloadTask,
        resolve: (blob: ReturnData) => void,
        reject: (error: any) => void
    }[] = []; // 下载任务队列
    private readonly maxConcurrentDownloads: number; // 最大并行下载任务数
    private currentDownloads: number = 0; // 当前进行中的下载任务数
    private downloadInstances: DownloadInstance[] = [];

    constructor(maxConcurrentDownloads: number) {
        this.maxConcurrentDownloads = maxConcurrentDownloads;
    }

    public addDownload(task: DownloadTask): Promise<ReturnData> {
        return new Promise<ReturnData>((resolve, reject) => {
            this.queue.push({
                task: task,
                resolve: resolve,
                reject: reject
            });
            this.startNextDownload();
        })
    }

    public cancelAllDownloads() {
        this.downloadInstances.forEach(instance => instance.cancel()); // 调用每个下载实例的取消方法
        this.queue = []; // 清空队列
    }

    private async startNextDownload(completeDownload: () => void = () => {
    }) {
        while (this.currentDownloads < this.maxConcurrentDownloads && this.queue.length > 0) {
            const task = this.queue.shift()!; // 获取下一个下载任务
            const downloadManager = new DownloadInstance(task.task);
            this.downloadInstances.push(downloadManager);
            this.currentDownloads++; // 增加当前下载数

            try {
                const blob = await downloadManager.start();
                task.resolve(blob);
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