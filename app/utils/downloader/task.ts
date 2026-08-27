import type {ZipWriter} from "@zip.js/zip.js";
import {HTTPError} from "~/utils/downloader/error";
import {type ChunkStorage, IDBChunkStorage, OPFSChunkStorage} from "~/utils/downloader/cacheStorage";
import {createApiResponseError} from "~/utils/apiError";

const DEFAULT_MAX_RETRIES = 3;
const RETRY_DELAY_MS = 200;

function positiveInteger(value: number | undefined, fallback: number): number {
    return Number.isFinite(value) && value! > 0 ? Math.max(1, Math.floor(value!)) : fallback;
}

function retryCount(value: number | undefined): number {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value!)) : DEFAULT_MAX_RETRIES;
}

function retryableStatus(status: number): boolean {
    return status === 408 || status === 416 || status === 425 || status === 429 || status >= 500;
}

function parseContentRange(value: string | null): { start: number; end: number; total: number } | null {
    const match = value?.match(/^bytes\s+(\d+)-(\d+)\/(\d+)$/i);
    if (!match) return null;
    return {
        start: Number(match[1]),
        end: Number(match[2]),
        total: Number(match[3]),
    };
}

async function waitBeforeRetry(signal: AbortSignal, attempt: number): Promise<void> {
    const delay = Math.min(RETRY_DELAY_MS * 2 ** Math.max(0, attempt - 1), 2000);
    if (signal.aborted) throw signal.reason ?? new Error("Task Cancelled");
    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, delay);
        const onAbort = () => {
            clearTimeout(timer);
            signal.removeEventListener('abort', onAbort);
            reject(signal.reason ?? new Error("Task Cancelled"));
        };
        signal.addEventListener('abort', onAbort, { once: true });
    });
}

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
        let response: Response | null = null;
        try {
            response = await fetch(this.URL, {
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
        } finally {
            // The probe body is not used. Release it so a batch cannot exhaust the browser's connections.
            try {
                await response?.body?.cancel();
            } catch {
                // The response may already have been closed by the runtime.
            }
        }
    }
    
    /*
     * @throw HTTPError
     */
    public async download(): Promise<void> {
        const size = await this.getFileSize();
        if (size <= 0) {
            let resp: Response | null = null;
            const maxRetries = retryCount(this.options.maxRetries);
            for (let i = 0; i <= maxRetries; i++) {
                if (i > 0) await waitBeforeRetry(this.signal.signal, i);
                let fetchResp: Response;
                try {
                    fetchResp = await fetch(this.URL, {signal: this.signal.signal});
                } catch (e) {
                    if (this.signal.signal.aborted) throw e;
                    if (i === maxRetries) throw e;
                    continue;
                }
                
                if (!fetchResp.ok) {
                    if (fetchResp.status >= 400 && fetchResp.status < 500 && fetchResp.status !== 408) {
                        throw await createApiResponseError(fetchResp, '下载资源');
                    }
                    if (i === maxRetries) throw await createApiResponseError(fetchResp, '下载资源');
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
            const chunkSize = positiveInteger(this.options.chunkSize, 1);
            const maxThreads = positiveInteger(this.options.maxThreads, 1);
            const chunksCount = Math.ceil(size / chunkSize);

            const useOPFS = await this.checkSupportOPFS();
            this.storage = useOPFS ? new OPFSChunkStorage(this.taskId) : new IDBChunkStorage(this.taskId);

            let loadedBytes = 0;
            let downloadError: unknown;
            let cleanupError: unknown;
            try {
                let currentIndex = 1;
                const next = async () => {
                    while (true) {
                        if (this.signal.signal.aborted) {
                            throw this.signal.signal.reason ?? new Error("Task Cancelled");
                        }
                        const chunkIndex = currentIndex++;
                        if (chunkIndex > chunksCount) return;

                        const downloadedSize = await this.downloadSubTask(
                            chunkSize,
                            size,
                            chunkIndex,
                            chunkIndex === chunksCount,
                        );
                        loadedBytes += downloadedSize;
                        this.options.onProgress?.(Math.min(loadedBytes, size), size);
                    }
                };

                const workers = Array.from({ length: Math.min(maxThreads, chunksCount) }, next);
                try {
                    await Promise.all(workers);
                } catch (error) {
                    downloadError = error;
                    this.signal.abort(error);
                    // Do not clear storage while another worker is still writing a chunk.
                    await Promise.allSettled(workers);
                    throw error;
                }

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
                    try {
                        await this.storage.clear();
                    } catch (error) {
                        cleanupError = error;
                        if (downloadError !== undefined) {
                            console.warn('Failed to clear download chunk cache after a failed task', error);
                        }
                    }
                }
            }
            if (cleanupError !== undefined && downloadError === undefined) {
                throw cleanupError;
            }
        }
    }

    private async downloadSubTask(chunkSize: number, fileSize: number, index: number, isLastChunk: boolean): Promise<number> {
        const start = (index - 1) * chunkSize;
        const end = isLastChunk ? fileSize - 1 : index * chunkSize - 1;
        const expectedLength = end - start + 1;
        const maxRetries = retryCount(this.options.maxRetries);
        let lastError: unknown = new Error(`Empty response for download chunk ${index}`);

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            if (attempt > 0) await waitBeforeRetry(this.signal.signal, attempt);
            if (this.signal.signal.aborted) {
                throw this.signal.signal.reason ?? new Error("Task Cancelled");
            }

            let resp: Response;
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
                continue;
            }

            if (!resp.ok) {
                const error = await createApiResponseError(resp, `下载分片 ${index}`);
                try {
                    await resp.body?.cancel();
                } catch {
                    // Ignore cleanup errors before retrying or surfacing the response error.
                }
                if (!retryableStatus(resp.status) || attempt === maxRetries) throw error;
                lastError = error;
                continue;
            }

            if (resp.status !== 206 && !(resp.status === 200 && start === 0 && expectedLength === fileSize)) {
                lastError = new Error(`Unexpected range response for chunk ${index}: HTTP ${resp.status}`);
                try {
                    await resp.body?.cancel();
                } catch {
                    // Ignore cleanup errors before retrying the request.
                }
                continue;
            }

            try {
                const contentRange = resp.headers.get('content-range');
                const range = parseContentRange(contentRange);
                if (
                    (contentRange && !range)
                    || (range && (range.start !== start || range.end !== end || range.total !== fileSize))
                ) {
                    throw new Error(`Invalid Content-Range for download chunk ${index}`);
                }

                const buf = await resp.arrayBuffer();
                if (buf.byteLength !== expectedLength) {
                    throw new Error(`Invalid body length for download chunk ${index}: expected ${expectedLength}, got ${buf.byteLength}`);
                }
                await this.storage?.writeChunk(index, new Uint8Array(buf));
                return buf.byteLength;
            } catch (error) {
                if (this.signal.signal.aborted) throw error;
                try {
                    await resp.body?.cancel();
                } catch {
                    // Ignore cleanup errors before retrying the request.
                }
                lastError = error;
            }
        }

        throw lastError instanceof Error
            ? lastError
            : new HTTPError(502, `Download chunk ${index} failed`);
    }
}
