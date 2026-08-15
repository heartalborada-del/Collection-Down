import { Buffer } from 'node:buffer';
import { connect, type TLSSocket } from 'node:tls';

const CONNECTION_ADDRESS = 'security.bilibili.com';
const TLS_SERVER_NAME = 'security.bilibili.com';
const CONNECTION_TIMEOUT_MS = 10_000;
const MAX_HEADER_BYTES = 64 * 1024;
const MAX_BODY_BYTES = 16 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const ALLOWED_HOSTS = new Set([
    'api.bilibili.com',
    'security.bilibili.com',
    'www.bilibili.com',
]);
const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
]);

interface ParsedHttpResponse {
    status: number;
    statusText: string;
    headers: Headers;
    body: Buffer<ArrayBufferLike>;
    reusable: boolean;
}

export interface BilibiliTcpConnectionInfo {
    id: number;
    localAddress: string | null;
    localPort: number | null;
    remoteAddress: string | null;
    remotePort: number | null;
    authorized: boolean;
    authorizationError: string | null;
    alpnProtocol: string | null;
    servername: string;
}

export interface BilibiliTcpClientStats {
    connectionsOpened: number;
    requestsCompleted: number;
    activeConnection: BilibiliTcpConnectionInfo | null;
    lastApiConnectionId: number | null;
    lastResponseConnectionId: number | null;
    state: BilibiliTcpClientState;
}

export type BilibiliTcpClientState = 'idle' | 'reusable' | 'final-request' | 'closed';

function waitForSecureConnection(socket: TLSSocket): Promise<void> {
    return new Promise((resolve, reject) => {
        const onSecureConnect = () => {
            cleanup();
            resolve();
        };
        const onError = (error: Error) => {
            cleanup();
            reject(error);
        };
        const cleanup = () => {
            socket.off('secureConnect', onSecureConnect);
            socket.off('error', onError);
        };

        socket.once('secureConnect', onSecureConnect);
        socket.once('error', onError);
    });
}

class Http1ResponseReader {
    private buffer = Buffer.alloc(0);
    private readonly iterator: AsyncIterator<Buffer | Uint8Array>;

    constructor(socket: TLSSocket) {
        this.iterator = socket[Symbol.asyncIterator]();
    }

    private async readMore(limit: number): Promise<void> {
        const next = await this.iterator.next();
        if (next.done || !next.value) {
            throw new Error('Bilibili TLS connection ended before the HTTP response was complete');
        }
        this.buffer = Buffer.concat([this.buffer, Buffer.from(next.value)]);
        if (this.buffer.length > limit) {
            throw new Error('Bilibili HTTP response exceeded the configured size limit');
        }
    }

    private async ensureLength(length: number, limit: number): Promise<void> {
        while (this.buffer.length < length) {
            await this.readMore(limit);
        }
    }

    private async readHeaderBlock(): Promise<string> {
        let headerEnd = this.buffer.indexOf('\r\n\r\n');
        while (headerEnd < 0) {
            await this.readMore(MAX_HEADER_BYTES);
            headerEnd = this.buffer.indexOf('\r\n\r\n');
        }

        const headerBlock = this.buffer.subarray(0, headerEnd).toString('latin1');
        this.buffer = this.buffer.subarray(headerEnd + 4);
        return headerBlock;
    }

    private async readChunkedBody(): Promise<Buffer> {
        const chunks: Buffer[] = [];
        let totalLength = 0;

        while (true) {
            let lineEnd = this.buffer.indexOf('\r\n');
            while (lineEnd < 0) {
                await this.readMore(MAX_BODY_BYTES + MAX_HEADER_BYTES);
                lineEnd = this.buffer.indexOf('\r\n');
            }

            const sizeText = this.buffer.subarray(0, lineEnd).toString('ascii').split(';', 1)[0]?.trim();
            if (!sizeText || !/^[\da-f]+$/i.test(sizeText)) {
                throw new Error('Bilibili returned an invalid chunked HTTP response');
            }
            const chunkLength = Number.parseInt(sizeText, 16);
            this.buffer = this.buffer.subarray(lineEnd + 2);

            if (chunkLength === 0) {
                while (this.buffer.length < 2) {
                    await this.readMore(MAX_BODY_BYTES + MAX_HEADER_BYTES);
                }
                if (this.buffer.subarray(0, 2).equals(Buffer.from('\r\n'))) {
                    this.buffer = this.buffer.subarray(2);
                    return Buffer.concat(chunks, totalLength);
                }

                let trailerEnd = this.buffer.indexOf('\r\n\r\n');
                while (trailerEnd < 0) {
                    await this.readMore(MAX_BODY_BYTES + MAX_HEADER_BYTES);
                    trailerEnd = this.buffer.indexOf('\r\n\r\n');
                }
                this.buffer = this.buffer.subarray(trailerEnd + 4);
                return Buffer.concat(chunks, totalLength);
            }

            totalLength += chunkLength;
            if (totalLength > MAX_BODY_BYTES) {
                throw new Error('Bilibili HTTP response body exceeded the configured size limit');
            }
            await this.ensureLength(chunkLength + 2, MAX_BODY_BYTES + MAX_HEADER_BYTES);
            if (!this.buffer.subarray(chunkLength, chunkLength + 2).equals(Buffer.from('\r\n'))) {
                throw new Error('Bilibili returned a malformed chunked HTTP response');
            }
            chunks.push(this.buffer.subarray(0, chunkLength));
            this.buffer = this.buffer.subarray(chunkLength + 2);
        }
    }

    async read(requestMethod: string): Promise<ParsedHttpResponse> {
        const headerBlock = await this.readHeaderBlock();
        const lines = headerBlock.split('\r\n');
        const statusLine = lines.shift() ?? '';
        const statusMatch = /^HTTP\/1\.[01] (\d{3})(?: (.*))?$/.exec(statusLine);
        if (!statusMatch) {
            throw new Error('Bilibili returned an invalid HTTP status line');
        }

        const headers = new Headers();
        for (const line of lines) {
            const separator = line.indexOf(':');
            if (separator <= 0) continue;
            headers.append(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
        }

        const status = Number(statusMatch[1]);
        const hasBody = requestMethod !== 'HEAD'
            && status >= 200
            && status !== 204
            && status !== 304;
        let body: Buffer<ArrayBufferLike> = Buffer.alloc(0);
        if (hasBody && headers.get('transfer-encoding')?.toLowerCase().includes('chunked')) {
            body = await this.readChunkedBody();
        } else if (hasBody && headers.has('content-length')) {
            const contentLength = Number(headers.get('content-length'));
            if (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > MAX_BODY_BYTES) {
                throw new Error('Bilibili returned an invalid HTTP content length');
            }
            await this.ensureLength(contentLength, MAX_BODY_BYTES + MAX_HEADER_BYTES);
            body = this.buffer.subarray(0, contentLength);
            this.buffer = this.buffer.subarray(contentLength);
        } else if (hasBody) {
            throw new Error('Bilibili returned a response without a reusable body boundary');
        }

        const reusable = headers.get('connection')?.toLowerCase() !== 'close';
        for (const name of HOP_BY_HOP_RESPONSE_HEADERS) {
            headers.delete(name);
        }
        return {
            status,
            statusText: statusMatch[2] ?? '',
            headers,
            body,
            reusable,
        };
    }
}

function validateUrl(input: string | URL): URL {
    const url = new URL(input);
    if (
        url.protocol !== 'https:'
        || url.port !== ''
        || url.username !== ''
        || url.password !== ''
        || !ALLOWED_HOSTS.has(url.hostname)
    ) {
        throw new TypeError(`Unsupported Bilibili TCP URL: ${url.origin}`);
    }
    return url;
}

async function serializeBody(body: BodyInit | null | undefined): Promise<Buffer> {
    if (body === undefined || body === null) return Buffer.alloc(0);
    if (typeof body === 'string') return Buffer.from(body);
    if (body instanceof URLSearchParams) return Buffer.from(body.toString());
    if (body instanceof ArrayBuffer) return Buffer.from(body);
    if (ArrayBuffer.isView(body)) {
        return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
    }
    if (body instanceof Blob) return Buffer.from(await body.arrayBuffer());
    throw new TypeError('Streaming request bodies are not supported by the Bilibili TCP client');
}

function shouldRedirect(status: number): boolean {
    return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

export class BilibiliTcpClient {
    private socket: TLSSocket | undefined;
    private reader: Http1ResponseReader | undefined;
    private queue: Promise<void> = Promise.resolve();
    private connectionId = 0;
    private requestsCompleted = 0;
    private lastApiConnectionId: number | null = null;
    private lastResponseConnectionId: number | null = null;
    private state: BilibiliTcpClientState = 'idle';
    private finalRequestScheduled = false;

    private destroyConnection(): void {
        this.socket?.destroy();
        this.socket = undefined;
        this.reader = undefined;
    }

    private invalidateConnection(): void {
        this.destroyConnection();
        if (this.state !== 'closed' && this.state !== 'final-request') {
            this.state = 'idle';
        }
    }

    private hasReusableConnection(): boolean {
        const socket = this.socket;
        return Boolean(
            socket
            && this.reader
            && !socket.destroyed
            && socket.readable
            && !socket.readableEnded
            && socket.writable
            && !socket.writableEnded,
        );
    }

    private assertNormalRequestAllowed(): void {
        if (this.state === 'closed') {
            throw new Error('Bilibili TCP client is permanently closed');
        }
        if (this.state === 'final-request') {
            throw new Error('Bilibili TCP client is executing its final request');
        }
    }

    private async ensureConnection(): Promise<void> {
        this.assertNormalRequestAllowed();
        if (this.state === 'reusable' && this.hasReusableConnection()) return;

        this.invalidateConnection();
        const socket = connect({
            host: CONNECTION_ADDRESS,
            port: 443,
            servername: TLS_SERVER_NAME,
            rejectUnauthorized: true,
        });
        socket.setNoDelay(true);
        socket.setKeepAlive(true, 30_000);
        socket.setTimeout(CONNECTION_TIMEOUT_MS, () => {
            socket.destroy(new Error('Bilibili TLS request timed out'));
        });
        this.socket = socket;
        try {
            await waitForSecureConnection(socket);
            this.assertNormalRequestAllowed();
            if (this.socket !== socket || !socket.readable || !socket.writable) {
                throw new Error('Bilibili TLS connection became unavailable during setup');
            }
            this.reader = new Http1ResponseReader(socket);
            this.connectionId++;
        } catch (error) {
            socket.destroy();
            if (this.socket === socket) this.invalidateConnection();
            throw error;
        }
    }

    private getConnectionInfo(): BilibiliTcpConnectionInfo | null {
        const socket = this.socket;
        if (!socket || socket.destroyed) return null;
        const authorizationError = socket.authorizationError;
        return {
            id: this.connectionId,
            localAddress: socket.localAddress ?? null,
            localPort: socket.localPort ?? null,
            remoteAddress: socket.remoteAddress ?? null,
            remotePort: socket.remotePort ?? null,
            authorized: socket.authorized,
            authorizationError: authorizationError instanceof Error
                ? authorizationError.message
                : authorizationError ?? null,
            alpnProtocol: socket.alpnProtocol || null,
            servername: TLS_SERVER_NAME,
        };
    }

    private async writeRequest(url: URL, init: RequestInit): Promise<string> {
        const method = (init.method ?? 'GET').toUpperCase();
        const headers = new Headers(init.headers);
        const body = await serializeBody(init.body);
        headers.delete('connection');
        headers.delete('content-length');
        headers.delete('host');
        headers.delete('transfer-encoding');
        headers.set('accept-encoding', 'identity');
        headers.set('connection', 'keep-alive');
        headers.set('host', url.hostname);
        if (body.length > 0 || (init.body !== undefined && init.body !== null)) {
            headers.set('content-length', String(body.length));
        }

        const requestLines = [`${method} ${url.pathname}${url.search} HTTP/1.1`];
        headers.forEach((value, name) => requestLines.push(`${name}: ${value}`));
        requestLines.push('', '');
        const payload = body.length > 0
            ? Buffer.concat([Buffer.from(requestLines.join('\r\n'), 'latin1'), body])
            : Buffer.from(requestLines.join('\r\n'), 'latin1');
        const socket = this.socket;
        if (!socket) throw new Error('Bilibili TLS connection is unavailable');

        await new Promise<void>((resolve, reject) => {
            socket.write(payload, (error?: Error | null) => {
                if (error) reject(error);
                else resolve();
            });
        });
        return method;
    }

    private async requestOnce(
        url: URL,
        init: RequestInit,
        existingConnectionOnly = false,
    ): Promise<ParsedHttpResponse> {
        if (existingConnectionOnly) {
            if (this.state !== 'final-request' || !this.hasReusableConnection()) {
                throw new Error('Bilibili final request requires an existing reusable TLS connection');
            }
        } else {
            await this.ensureConnection();
        }
        const method = await this.writeRequest(url, init);
        const reader = this.reader;
        if (!reader) throw new Error('Bilibili HTTP response reader is unavailable');
        const response = await reader.read(method);
        this.requestsCompleted++;
        this.lastResponseConnectionId = this.connectionId;
        if (url.hostname === 'api.bilibili.com') {
            this.lastApiConnectionId = this.connectionId;
        }
        if (!response.reusable || !this.hasReusableConnection()) {
            this.invalidateConnection();
        } else if (!existingConnectionOnly) {
            this.state = 'reusable';
        }
        return response;
    }

    private async requestWithRetry(url: URL, init: RequestInit): Promise<ParsedHttpResponse> {
        const method = (init.method ?? 'GET').toUpperCase();
        const maxAttempts = method === 'GET' || method === 'HEAD' ? 2 : 1;
        let lastError: unknown;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                return await this.requestOnce(url, init);
            } catch (error) {
                lastError = error;
                this.invalidateConnection();
            }
        }
        throw lastError;
    }

    private async runFetch(
        input: string | URL,
        init: RequestInit,
        existingConnectionOnly = false,
    ): Promise<Response> {
        let url = validateUrl(input);
        if (existingConnectionOnly && url.hostname !== 'security.bilibili.com') {
            throw new TypeError('Bilibili final request must target security.bilibili.com');
        }
        if (!existingConnectionOnly && url.hostname === 'security.bilibili.com') {
            throw new TypeError('Requests to security.bilibili.com must use fetchFinal()');
        }
        let requestInit = { ...init };
        let redirected = false;

        for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
            const parsed = existingConnectionOnly
                ? await this.requestOnce(url, requestInit, true)
                : await this.requestWithRetry(url, requestInit);
            const location = parsed.headers.get('location');
            const redirectMode = requestInit.redirect ?? 'follow';
            if (!location || !shouldRedirect(parsed.status) || redirectMode === 'manual') {
                const responseBody = parsed.status === 204 || parsed.status === 304
                    ? null
                    : parsed.body.buffer instanceof ArrayBuffer
                        ? new Uint8Array(parsed.body.buffer, parsed.body.byteOffset, parsed.body.byteLength)
                        : Uint8Array.from(parsed.body);
                const response = new Response(responseBody, {
                    status: parsed.status,
                    statusText: parsed.statusText,
                    headers: parsed.headers,
                });
                Object.defineProperties(response, {
                    redirected: { value: redirected },
                    url: { value: url.toString() },
                });
                return response;
            }
            if (redirectMode === 'error') {
                throw new TypeError('Bilibili TCP request encountered a disallowed redirect');
            }
            if (redirectCount === MAX_REDIRECTS) {
                throw new TypeError('Bilibili TCP request exceeded the redirect limit');
            }

            url = validateUrl(new URL(location, url));
            if (existingConnectionOnly && url.hostname !== 'security.bilibili.com') {
                throw new TypeError('Bilibili final request redirect left security.bilibili.com');
            }
            if (!existingConnectionOnly && url.hostname === 'security.bilibili.com') {
                throw new TypeError('Redirects to security.bilibili.com require fetchFinal()');
            }
            redirected = true;
            const method = (requestInit.method ?? 'GET').toUpperCase();
            if (parsed.status === 303 || ((parsed.status === 301 || parsed.status === 302) && method === 'POST')) {
                const headers = new Headers(requestInit.headers);
                headers.delete('content-length');
                headers.delete('content-type');
                requestInit = { ...requestInit, method: 'GET', body: undefined, headers };
            }
        }
        throw new TypeError('Bilibili TCP request exceeded the redirect limit');
    }

    private async runFinalFetch(input: string | URL, init: RequestInit): Promise<Response> {
        try {
            if (this.state === 'closed') {
                throw new Error('Bilibili TCP client is permanently closed');
            }
            if (
                this.state !== 'reusable'
                || !this.hasReusableConnection()
                || this.lastApiConnectionId !== this.connectionId
            ) {
                throw new Error('Bilibili final request requires a reusable TLS connection established by an API request');
            }
            this.socket?.setTimeout(CONNECTION_TIMEOUT_MS);
            this.state = 'final-request';
            return await this.runFetch(input, init, true);
        } finally {
            this.close();
        }
    }

    fetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
        if (this.state === 'closed') {
            return Promise.reject(new Error('Bilibili TCP client is permanently closed'));
        }
        if (this.finalRequestScheduled) {
            return Promise.reject(new Error('Bilibili TCP client cannot accept requests after its final request'));
        }
        const result = this.queue.then(() => this.runFetch(input, init));
        this.queue = result.then(() => undefined, () => undefined);
        return result;
    }

    fetchFinal(input: string | URL, init: RequestInit = {}): Promise<Response> {
        if (this.state === 'closed') {
            return Promise.reject(new Error('Bilibili TCP client is permanently closed'));
        }
        if (this.finalRequestScheduled) {
            return Promise.reject(new Error('Bilibili TCP client final request was already scheduled'));
        }
        this.finalRequestScheduled = true;
        const result = this.queue.then(() => this.runFinalFetch(input, init));
        this.queue = result.then(() => undefined, () => undefined);
        return result;
    }

    holdForFinalRequest(timeoutMs: number): void {
        if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
            throw new TypeError('Bilibili final request timeout must be a positive integer');
        }
        if (
            this.state !== 'reusable'
            || !this.hasReusableConnection()
            || this.lastApiConnectionId !== this.connectionId
        ) {
            throw new Error('Bilibili final request wait requires a reusable TLS connection established by an API request');
        }
        this.socket?.setTimeout(timeoutMs);
    }

    getStats(): BilibiliTcpClientStats {
        return {
            connectionsOpened: this.connectionId,
            requestsCompleted: this.requestsCompleted,
            activeConnection: this.getConnectionInfo(),
            lastApiConnectionId: this.lastApiConnectionId,
            lastResponseConnectionId: this.lastResponseConnectionId,
            state: this.state,
        };
    }

    close(): void {
        if (this.state === 'closed') return;
        this.finalRequestScheduled = true;
        this.state = 'closed';
        this.destroyConnection();
    }
}
