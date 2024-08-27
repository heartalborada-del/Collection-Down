interface DownloadManager {
    cancel: () => void;
}

export class Downloader {
    private url: string;
    private threadCount: number;
    private onProgress?: (downloadedBytes: number, totalBytes: number) => void;
    private downloadedBytes: number = 0; // 当前下载的字节数
    private isCanceled: boolean = false; // 下载是否被取消
    private hasErrorOccurred: boolean = false; // 是否发生错误
    private blobResult: Blob | null = null; // 存储下载的 Blob

    constructor(url: string, threadCount: number, onProgress?: (downloadedBytes: number, totalBytes: number) => void) {
        this.url = url;
        this.threadCount = threadCount;
        this.onProgress = onProgress;
    }

    public cancel() {
        this.isCanceled = true;
    }

    public async startDownload(): Promise<{ blob: Blob; type: string }> {
        try {
            return await this.download();
        } catch (err) {
            if (this.isCanceled) {
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

    private async download(): Promise<{ blob: Blob; type: string }> {
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
                        if (!chunkResponse.ok) throw new Error(`Failed to fetch chunk: ${chunkResponse.statusText}`);

                        const chunkData = await chunkResponse.arrayBuffer();
                        fileData.set(new Uint8Array(chunkData), start);
                        this.downloadedBytes += chunkData.byteLength; // 更新当前下载的字节数

                        // 调用进度回调
                        if (this.onProgress && !this.isCanceled && !this.hasErrorOccurred) {
                            this.onProgress(this.downloadedBytes, contentLength); // 报告当前下载的字节数和总字节数
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
                if (this.isCanceled || this.hasErrorOccurred) {
                    throw new Error('Download canceled or an error occurred');
                }
            }
            await Promise.all(promises);
            this.blobResult = new Blob([fileData]);
            return {
                blob: this.blobResult,
                type: response.headers.get('Content-Type') || ''
            };
        } else {
            const response = await fetch(this.url);
            if (!response.ok) return Promise.reject(new Error(`Failed to fetch file: ${response.statusText}`));
            this.blobResult = await response.blob();
            return {
                blob: this.blobResult,
                type: response.headers.get('Content-Type') || ''
            };
        }
    }
}
