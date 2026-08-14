import type { ApiResponse } from '~~/types/api/root';
import {
    BILIBILI_POW_HTTP_STATUS,
    BILIBILI_POW_REQUIRED_CODE,
    BILIBILI_POW_WS_PATH,
    BILIBILI_POW_WS_TIMEOUT_MS,
    isBilibiliPowChallenge,
    type BilibiliPowChallenge,
    type BilibiliPowVerificationRequest,
    type BilibiliPowWorkerRequest,
    type BilibiliPowWorkerResponse,
    type BilibiliPowWsServerMessage,
} from '~~/types/api/bili/pow';

const MAX_CHALLENGE_RETRIES = 2;
const MAX_POW_WORKERS = 4;
const activeVerifications = new Map<string, Promise<void>>();

class BilibiliPowVerificationError extends Error {
    constructor(message: string, readonly allowWebSocketFallback: boolean) {
        super(message);
        this.name = 'BilibiliPowVerificationError';
    }
}

async function readPowChallenge(response: Response): Promise<BilibiliPowChallenge | undefined> {
    if (response.status !== BILIBILI_POW_HTTP_STATUS) return undefined;
    try {
        const body = await response.clone().json() as ApiResponse<unknown>;
        return body.code === BILIBILI_POW_REQUIRED_CODE && isBilibiliPowChallenge(body.data)
            ? body.data
            : undefined;
    } catch {
        return undefined;
    }
}

function solvePow(challenge: BilibiliPowChallenge, signal?: AbortSignal): Promise<number> {
    if (challenge.expiresAt <= Date.now()) {
        return Promise.reject(new Error('Bilibili security challenge has expired'));
    }
    if (signal?.aborted) {
        return Promise.reject(new Error('Bilibili proof-of-work calculation was cancelled'));
    }

    const workerCount = Math.min(
        MAX_POW_WORKERS,
        Math.max(1, navigator.hardwareConcurrency || 1),
        challenge.maxIterations,
    );
    const rangeSize = Math.ceil(challenge.maxIterations / workerCount);

    return new Promise<number>((resolve, reject) => {
        const workers: Worker[] = [];
        let completed = 0;
        let settled = false;
        const timeout = window.setTimeout(() => {
            finish(undefined, new Error('Bilibili security challenge expired during calculation'));
        }, Math.max(1, challenge.expiresAt - Date.now()));
        const handleAbort = () => {
            finish(undefined, new Error('Bilibili proof-of-work calculation was cancelled'));
        };

        const finish = (result?: number, error?: Error) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            signal?.removeEventListener('abort', handleAbort);
            workers.forEach(worker => worker.terminate());
            if (result !== undefined) resolve(result);
            else reject(error ?? new Error('No valid Bilibili proof-of-work result was found'));
        };
        signal?.addEventListener('abort', handleAbort, { once: true });

        for (let index = 0; index < workerCount; index++) {
            const start = index * rangeSize;
            const end = Math.min(start + rangeSize, challenge.maxIterations);
            const worker = new Worker(new URL('./bilibiliPow.worker.ts', import.meta.url), { type: 'module' });
            workers.push(worker);
            worker.onmessage = (event: MessageEvent<BilibiliPowWorkerResponse>) => {
                if (event.data.error) {
                    finish(undefined, new Error(event.data.error));
                    return;
                }
                if (Number.isInteger(event.data.result)) {
                    finish(event.data.result);
                    return;
                }
                completed++;
                if (completed === workerCount) finish();
            };
            worker.onerror = () => finish(undefined, new Error('Bilibili proof-of-work worker failed'));
            worker.postMessage({ q: challenge.q, r: challenge.r, start, end } satisfies BilibiliPowWorkerRequest);
        }
    });
}

async function solveAndVerify(challenge: BilibiliPowChallenge): Promise<void> {
    const result = await solvePow(challenge);
    const requestBody: BilibiliPowVerificationRequest = { token: challenge.token, result };
    const response = await fetch('/api/bili/pow/verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(requestBody),
    });
    let body: ApiResponse<unknown> | undefined;
    try {
        body = await response.json() as ApiResponse<unknown>;
    } catch {
        // The HTTP status is used below when the server did not return JSON.
    }
    if (!response.ok || body?.code !== 0) {
        throw new BilibiliPowVerificationError(
            body?.message || `Bilibili security verification failed (HTTP ${response.status})`,
            response.status === 502,
        );
    }
}

function ensureChallengeVerified(challenge: BilibiliPowChallenge): Promise<void> {
    const pending = activeVerifications.get(challenge.token);
    if (pending) return pending;

    const verification = solveAndVerify(challenge).finally(() => {
        activeVerifications.delete(challenge.token);
    });
    activeVerifications.set(challenge.token, verification);
    return verification;
}

function parseWebSocketServerMessage(value: unknown): BilibiliPowWsServerMessage | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const message = value as Partial<BilibiliPowWsServerMessage>;
    if (message.type === 'challenge') {
        return isBilibiliPowChallenge(message.challenge)
            ? { type: 'challenge', challenge: message.challenge }
            : undefined;
    }
    if (message.type === 'error') {
        return typeof message.message === 'string' && message.message.length > 0
            ? { type: 'error', message: message.message }
            : undefined;
    }
    if (message.type === 'response') {
        const headersAreValid = Array.isArray(message.headers)
            && message.headers.every(header => Array.isArray(header)
                && header.length === 2
                && typeof header[0] === 'string'
                && typeof header[1] === 'string');
        return Number.isInteger(message.status)
            && Number(message.status) >= 200
            && Number(message.status) <= 599
            && typeof message.statusText === 'string'
            && headersAreValid
            && typeof message.body === 'string'
            ? {
                type: 'response',
                status: Number(message.status),
                statusText: message.statusText,
                headers: message.headers as [string, string][],
                body: message.body,
            }
            : undefined;
    }
    return undefined;
}

function getWebSocketFallbackPath(input: RequestInfo | URL, init: RequestInit): string {
    const method = (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method !== 'GET') {
        throw new Error('Bilibili WebSocket fallback only supports GET requests');
    }
    const rawUrl = input instanceof Request
        ? input.url
        : input instanceof URL
            ? input.href
            : input;
    const url = new URL(rawUrl, window.location.href);
    if (url.origin !== window.location.origin) {
        throw new Error('Bilibili WebSocket fallback only supports same-origin requests');
    }
    return `${url.pathname}${url.search}`;
}

function fetchBilibiliApiViaWebSocket(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
    const requestPath = getWebSocketFallbackPath(input, init);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socketUrl = `${protocol}//${window.location.host}${BILIBILI_POW_WS_PATH}`;

    return new Promise<Response>((resolve, reject) => {
        const socket = new WebSocket(socketUrl);
        const calculationController = new AbortController();
        let settled = false;
        let solving = false;
        const timeout = window.setTimeout(() => {
            finish(undefined, new Error('Bilibili WebSocket fallback timed out'));
        }, BILIBILI_POW_WS_TIMEOUT_MS);

        const finish = (response?: Response, error?: Error) => {
            if (settled) return;
            settled = true;
            calculationController.abort();
            window.clearTimeout(timeout);
            if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                socket.close(response ? 1000 : 1011, response ? 'complete' : 'failed');
            }
            if (response) resolve(response);
            else reject(error ?? new Error('Bilibili WebSocket fallback failed'));
        };

        const handleMessage = async (event: MessageEvent<string>) => {
            let message: BilibiliPowWsServerMessage | undefined;
            try {
                message = parseWebSocketServerMessage(JSON.parse(event.data));
            } catch {
                // Invalid JSON is handled as a protocol error below.
            }
            if (!message) {
                finish(undefined, new Error('Bilibili WebSocket returned an invalid message'));
                return;
            }
            if (message.type === 'error') {
                finish(undefined, new Error(message.message));
                return;
            }
            if (message.type === 'response') {
                finish(new Response(message.body, {
                    status: message.status,
                    statusText: message.statusText,
                    headers: message.headers,
                }));
                return;
            }
            if (solving) {
                finish(undefined, new Error('Bilibili WebSocket sent overlapping challenges'));
                return;
            }

            solving = true;
            try {
                const result = await solvePow(message.challenge, calculationController.signal);
                if (socket.readyState !== WebSocket.OPEN) {
                    throw new Error('Bilibili WebSocket closed before proof submission');
                }
                socket.send(JSON.stringify({
                    type: 'solution',
                    token: message.challenge.token,
                    result,
                }));
            } catch (error) {
                finish(undefined, error instanceof Error ? error : new Error('Bilibili WebSocket proof calculation failed'));
            } finally {
                solving = false;
            }
        };

        socket.addEventListener('open', () => {
            socket.send(JSON.stringify({ type: 'request', path: requestPath }));
        });
        socket.addEventListener('message', (event: MessageEvent<string>) => {
            void handleMessage(event);
        });
        socket.addEventListener('error', () => {
            finish(undefined, new Error('Unable to connect to Bilibili WebSocket fallback'));
        });
        socket.addEventListener('close', () => {
            if (!settled) {
                finish(undefined, new Error('Bilibili WebSocket fallback closed before completion'));
            }
        });
    });
}

export async function fetchBilibiliApi(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    for (let attempt = 0; attempt <= MAX_CHALLENGE_RETRIES; attempt++) {
        const requestInput = input instanceof Request ? input.clone() : input;
        const response = await fetch(requestInput, {
            ...init,
            credentials: init.credentials ?? 'same-origin',
        });
        const challenge = await readPowChallenge(response);
        if (!challenge) return response;
        if (attempt === MAX_CHALLENGE_RETRIES) {
            throw new Error('Bilibili security verification did not unlock the requested resource');
        }
        try {
            await ensureChallengeVerified(challenge);
        } catch (error) {
            if (error instanceof BilibiliPowVerificationError && error.allowWebSocketFallback) {
                return fetchBilibiliApiViaWebSocket(requestInput, init);
            }
            throw error;
        }
    }
    throw new Error('Bilibili security verification retry limit reached');
}
