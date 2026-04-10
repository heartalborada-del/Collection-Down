import type {ZipWriter} from "@zip.js/zip.js";
import {HTTPError} from "~/utils/downloader/error";
import {type ChunkStorage, IDBChunkStorage, OPFSChunkStorage} from "~/utils/downloader/cacheStorage";

export type DownloadTaskOptions = {
    maxThreads: number;
    chunkSize: number;
    onProgress?: (loaded: number, total: number) => void;
    maxRetries?: number;
}

export class DownloadTask {
    private readonly signal = new AbortController();
    private storage: ChunkStorage | null = null;
    private taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    public constructor(private FileWriter: ZipWriter<unknown>, private FileFullDirectory: string, private URL: string, private options: DownloadTaskOptions) {}

    public shutdown() {
        this.signal.abort("Task Cancelled");
    }

    private async checkSupportOPFS(): Promise<boolean> {
        try {
            const root = await navigator.storage.getDirectory();
            return !!root;
        } catch {
            return false;
        }
    }

    // Only support same-origin due to security
    private async getFileSize(): Promise<number> {
        try {
            const response = await fetch(this.URL, {
                method: 'GET',
                signal: this.signal.signal,
                cache: 'no-store',
                headers: {
                    'Range': 'bytes=0-0'
                }
            });
            // Support -> 206
            if (response.status === 206) {
                const contentRange = response.headers.get('content-range');
                if (contentRange) {
                    // Content-Range pattern: bytes 0-0/123456
                    const match = contentRange.match(/\/(\d+)$/);
                    if (match && match[1]) {
                        return parseInt(match[1], 10);
                    }
                }

                // check backup header
                const backupLength = response.headers.get('X-Length-Backup');
                if (backupLength) {
                    return parseInt(backupLength, 10);
                }
            }
            
            //Fallback
            return -1;
        } catch {
            return -1;
        }
    }
    
    /*
     * @throw HTTPError
     */
    public async download(): Promise<void> {
        const size = await this.getFileSize();
        if (size <= 0) {
            let resp: Response | null = null;
            const maxRetries = this.options.maxRetries ?? 3;
            let lastError: unknown = null;
            
            for (let i = 0; i <= maxRetries; i++) {
                let fetchResp: Response | null = null;
                try {
                    fetchResp = await fetch(this.URL, {signal: this.signal.signal});
                } catch (e) {
                    if (this.signal.signal.aborted) throw e;
                    lastError = e;
                    if (i === maxRetries) throw e;
                    continue;
                }
                
                if (!fetchResp.ok) {
                    if (fetchResp.status >= 400 && fetchResp.status < 500 && fetchResp.status !== 408) {
                        throw new HTTPError(fetchResp.status, fetchResp.statusText);
                    }
                    lastError = new Error(`HTTP ${fetchResp.status}`);
                    if (i === maxRetries) throw lastError;
                    continue;
                }
                
                resp = fetchResp;
                break;
            }

            if (!resp || !resp.body) {
                throw new HTTPError(500, "Response body is null or fetch failed");
            }
            
            // Read stream to report progress for single-thread fallback
            const total = parseInt(resp.headers.get("Content-Length") ?? "1", 10);
            let loaded = 0;
            const reader = resp.body.getReader();

            const progressStream = new ReadableStream({
                pull: async (controller) => {
                    const { done, value } = await reader.read();
                    if (done) {
                        controller.close();
                        this.options.onProgress?.(total, total);
                        return;
                    }
                    loaded += value.byteLength;
                    this.options.onProgress?.(loaded, total);
                    controller.enqueue(value);
                },
                cancel: () => {
                    reader.cancel();
                }
            });

            await this.FileWriter.add(this.FileFullDirectory, progressStream)
        } else {
            const chunkSize = this.options.chunkSize;
            const maxThreads = this.options.maxThreads;
            const chunksCount = Math.ceil(size / chunkSize);

            const useOPFS = await this.checkSupportOPFS();
            this.storage = useOPFS ? new OPFSChunkStorage(this.taskId) : new IDBChunkStorage(this.taskId);

            let loadedBytes = 0;
            try {
                let currentIndex = 1;
                let activeThreads = 0;
                await new Promise<void>((resolve, reject) => {
                    const next = async () => {
                        if (this.signal.signal.aborted) {
                            return reject(new Error("Task Cancelled"));
                        }

                        let chunkIndex = 0;
                        if (currentIndex <= chunksCount) {
                            chunkIndex = currentIndex++;
                            activeThreads++;
                        } else {
                            if (activeThreads === 0) resolve();
                            return;
                        }

                        try {
                            const downloadedSize = await this.downloadSubTask(chunkSize, size, chunkIndex, chunkIndex === chunksCount);
                            loadedBytes += downloadedSize;
                            this.options.onProgress?.(loadedBytes, size);

                            activeThreads--;
                            next();
                        } catch (e) {
                            reject(e);
                        }
                    };

                    for (let i = 0; i < Math.min(maxThreads, chunksCount); i++) {
                        next();
                    }
                });

                // Assemble the file and add to ZipWriter using a ReadableStream
                let chunkIndex = 1;
                const storage = this.storage!;
                const stream = new ReadableStream({
                    async pull(controller) {
                        if (chunkIndex > chunksCount) {
                            controller.close();
                            return;
                        }
                        const data = await storage.getChunk(chunkIndex++);
                        controller.enqueue(data);
                    }
                });

                await this.FileWriter.add(this.FileFullDirectory, stream);
            } finally {
                if (this.storage) {
                    await this.storage.clear();
                }
            }
        }
    }

    private async downloadSubTask(chunkSize: number, fileSize: number, index: number, isLastChunk: boolean, retryCount: number = 0): Promise<number> {
        const start = (index - 1) * chunkSize;
        const end = isLastChunk ? fileSize - 1 : index * chunkSize - 1;
        let lastError: unknown;
        
        let resp: Response | null = null;
        try {
            resp = await fetch(this.URL, {
                signal: this.signal.signal,
                cache: 'no-store',
                headers: {
                    'Range': `bytes=${start}-${end}`
                }
            });
        } catch (error) {
            if (this.signal.signal.aborted) throw error;
            lastError = error;
        }
        
        if (resp) {
            if (!resp.ok) {
                if (resp.status >= 400 && resp.status < 500 && resp.status !== 408) {
                    throw new HTTPError(resp.status, resp.statusText);
                }
                lastError = new Error(`HTTP ${resp.status}`);
            } else {
                let buf: ArrayBuffer;
                try {
                    buf = await resp.arrayBuffer();
                } catch (error) {
                    if (this.signal.signal.aborted) throw error;
                    lastError = error;
                    buf = new ArrayBuffer(0); // Will trigger retry below
                }
                
                if (buf.byteLength > 0) {
                    if (this.storage) {
                        try {
                            await this.storage.writeChunk(index, new Uint8Array(buf));
                        } catch (error) {
                            if (this.signal.signal.aborted) throw error;
                            lastError = error;
                        }
                    }
                    if (!lastError) return buf.byteLength;
                }
            }
        }
        
        const maxRetries = this.options.maxRetries ?? 3;
        if (retryCount < maxRetries) {
            return this.downloadSubTask(chunkSize, fileSize, index, isLastChunk, retryCount + 1);
        }
        throw lastError;
    }
}