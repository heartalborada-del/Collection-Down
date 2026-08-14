import type { Peer } from 'crossws';
import { defineWebSocketHandler } from 'h3';
import { useNitroApp } from 'nitropack/runtime';
import {
    BILIBILI_POW_REQUIRED_CODE,
    BILIBILI_POW_WS_MAX_CHALLENGES,
    isBilibiliPowChallenge,
    type BilibiliPowChallenge,
    type BilibiliPowWsClientMessage,
    type BilibiliPowWsServerMessage,
} from '~~/types/api/bili/pow';
import {
    BILIBILI_SECURITY_COOKIE,
    isBilibiliPowChallengeResponse,
    verifyBilibiliPowChallenge,
} from '~~/server/utils/bilibiliFetch';

const MAX_REQUEST_PATH_LENGTH = 4096;
const MAX_RESPONSE_BODY_LENGTH = 4 * 1024 * 1024;
const SESSION_CONTEXT_KEY = 'bilibiliPowWebSocketSession';
const ALLOWED_API_PATHS = new Set([
    '/api/bili/collection/allLotteryId',
    '/api/bili/collection/collectLootInfo',
    '/api/bili/collection/emojiPackageList',
    '/api/bili/collection/search',
    '/api/bili/suit/emojiPackageList',
    '/api/bili/suit/suitComponents',
]);

interface BilibiliPowWebSocketSession {
    phase: 'awaiting_request' | 'awaiting_solution' | 'complete';
    requestPath?: string;
    challenge?: BilibiliPowChallenge;
    challengeCount: number;
    processing: boolean;
    cookie: string;
}

function createSession(peer: Peer): BilibiliPowWebSocketSession {
    return {
        phase: 'awaiting_request',
        challengeCount: 0,
        processing: false,
        cookie: peer.request.headers.get('cookie')?.slice(0, 8192) ?? '',
    };
}

function isSession(value: unknown): value is BilibiliPowWebSocketSession {
    if (!value || typeof value !== 'object') return false;
    const session = value as Partial<BilibiliPowWebSocketSession>;
    return typeof session.phase === 'string'
        && Number.isInteger(session.challengeCount)
        && typeof session.processing === 'boolean'
        && typeof session.cookie === 'string';
}

function getSession(peer: Peer): BilibiliPowWebSocketSession {
    const session = peer.context[SESSION_CONTEXT_KEY];
    if (!isSession(session)) {
        throw new Error('WebSocket session is not initialized');
    }
    return session;
}

function send(peer: Peer, message: BilibiliPowWsServerMessage): void {
    peer.send(JSON.stringify(message));
}

function fail(peer: Peer, message: string): void {
    send(peer, { type: 'error', message });
    peer.close(1008, 'Bilibili PoW session failed');
}

function parseClientMessage(value: unknown): BilibiliPowWsClientMessage | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const message = value as Partial<BilibiliPowWsClientMessage>;
    if (message.type === 'request') {
        return typeof message.path === 'string'
            ? { type: 'request', path: message.path }
            : undefined;
    }
    if (message.type === 'solution') {
        return typeof message.token === 'string' && Number.isInteger(message.result)
            ? { type: 'solution', token: message.token, result: message.result as number }
            : undefined;
    }
    return undefined;
}

function normalizeRequestPath(path: string): string | undefined {
    if (!path.startsWith('/') || path.length > MAX_REQUEST_PATH_LENGTH) return undefined;
    try {
        const url = new URL(path, 'https://collection-down.invalid');
        if (url.origin !== 'https://collection-down.invalid' || url.hash || !ALLOWED_API_PATHS.has(url.pathname)) {
            return undefined;
        }
        return `${url.pathname}${url.search}`;
    } catch {
        return undefined;
    }
}

function appendCookie(cookie: string, name: string, value: string): string {
    const normalizedName = name.toLowerCase();
    const cookies = cookie
        .split(';')
        .map(part => part.trim())
        .filter(Boolean)
        .filter(part => part.split('=', 1)[0]?.trim().toLowerCase() !== normalizedName);
    cookies.push(`${name}=${encodeURIComponent(value)}`);
    return cookies.join('; ');
}

async function readChallenge(response: Response): Promise<BilibiliPowChallenge | undefined> {
    if (!isBilibiliPowChallengeResponse(response)) return undefined;
    try {
        const payload = await response.json() as { code?: unknown; data?: unknown };
        return payload.code === BILIBILI_POW_REQUIRED_CODE && isBilibiliPowChallenge(payload.data)
            ? payload.data
            : undefined;
    } catch {
        return undefined;
    }
}

async function sendFinalResponse(peer: Peer, response: Response): Promise<void> {
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BODY_LENGTH) {
        fail(peer, 'Bilibili API response is too large for WebSocket fallback');
        return;
    }

    const body = await response.text();
    if (body.length > MAX_RESPONSE_BODY_LENGTH) {
        fail(peer, 'Bilibili API response is too large for WebSocket fallback');
        return;
    }

    const excludedHeaders = new Set([
        'connection',
        'content-encoding',
        'content-length',
        'set-cookie',
        'transfer-encoding',
    ]);
    const headers = [...response.headers.entries()]
        .filter(([name]) => !excludedHeaders.has(name.toLowerCase()));
    send(peer, {
        type: 'response',
        status: response.status,
        statusText: response.statusText,
        headers,
        body,
    });
    getSession(peer).phase = 'complete';
}

async function runRequest(peer: Peer, session: BilibiliPowWebSocketSession, cookie = session.cookie): Promise<void> {
    if (!session.requestPath) {
        fail(peer, 'Bilibili PoW request path is missing');
        return;
    }

    const headers = new Headers({ accept: 'application/json' });
    if (cookie) headers.set('cookie', cookie);
    const response = await useNitroApp().localFetch(session.requestPath, {
        method: 'GET',
        headers,
    });
    if (!isBilibiliPowChallengeResponse(response)) {
        await sendFinalResponse(peer, response);
        return;
    }

    const challenge = await readChallenge(response);
    if (!challenge) {
        fail(peer, 'Bilibili returned an invalid WebSocket challenge');
        return;
    }
    if (session.challengeCount >= BILIBILI_POW_WS_MAX_CHALLENGES) {
        fail(peer, 'Bilibili WebSocket challenge retry limit reached');
        return;
    }

    session.challenge = challenge;
    session.challengeCount++;
    session.phase = 'awaiting_solution';
    send(peer, { type: 'challenge', challenge });
}

async function handleRequestMessage(
    peer: Peer,
    session: BilibiliPowWebSocketSession,
    message: Extract<BilibiliPowWsClientMessage, { type: 'request' }>,
): Promise<void> {
    if (session.phase !== 'awaiting_request') {
        fail(peer, 'Bilibili WebSocket request was already initialized');
        return;
    }
    const requestPath = normalizeRequestPath(message.path);
    if (!requestPath) {
        fail(peer, 'Bilibili WebSocket request path is not allowed');
        return;
    }
    session.requestPath = requestPath;
    await runRequest(peer, session);
}

async function handleSolutionMessage(
    peer: Peer,
    session: BilibiliPowWebSocketSession,
    message: Extract<BilibiliPowWsClientMessage, { type: 'solution' }>,
): Promise<void> {
    const challenge = session.challenge;
    if (session.phase !== 'awaiting_solution' || !challenge || message.token !== challenge.token) {
        fail(peer, 'Bilibili WebSocket solution does not match the active challenge');
        return;
    }

    session.challenge = undefined;
    const verification = await verifyBilibiliPowChallenge(message.token, message.result);
    if (!verification.ok) {
        if (verification.retryable && session.challengeCount < BILIBILI_POW_WS_MAX_CHALLENGES) {
            await runRequest(peer, session);
            return;
        }
        fail(peer, verification.message);
        return;
    }

    const retryCookie = appendCookie(session.cookie, BILIBILI_SECURITY_COOKIE, verification.securityToken);
    await runRequest(peer, session, retryCookie);
}

export default defineWebSocketHandler({
    upgrade(request) {
        const origin = request.headers.get('origin');
        const requestOrigin = new URL(request.url).origin;
        if (!origin || origin !== requestOrigin) {
            return new Response('WebSocket origin is not allowed', { status: 403 });
        }
    },
    open(peer) {
        peer.context[SESSION_CONTEXT_KEY] = createSession(peer);
    },
    async message(peer, rawMessage) {
        let message: BilibiliPowWsClientMessage | undefined;
        try {
            message = parseClientMessage(rawMessage.json<unknown>());
        } catch {
            // Invalid JSON is handled as a protocol error below.
        }
        if (!message) {
            fail(peer, 'Invalid Bilibili WebSocket message');
            return;
        }

        let session: BilibiliPowWebSocketSession;
        try {
            session = getSession(peer);
        } catch {
            fail(peer, 'Bilibili WebSocket session is unavailable');
            return;
        }
        if (session.processing || session.phase === 'complete') {
            fail(peer, 'Bilibili WebSocket session is busy');
            return;
        }

        session.processing = true;
        try {
            if (message.type === 'request') {
                await handleRequestMessage(peer, session, message);
            } else {
                await handleSolutionMessage(peer, session, message);
            }
        } catch (error) {
            console.warn({
                message: 'bilibili-api:websocket_session_error',
                scope: 'bilibili-api',
                event: 'websocket_session_error',
                errorType: error instanceof Error ? error.name : 'UnknownError',
            });
            fail(peer, 'Bilibili WebSocket fallback failed');
        } finally {
            session.processing = false;
        }
    },
    close(peer) {
        const session = peer.context[SESSION_CONTEXT_KEY];
        if (isSession(session)) {
            session.cookie = '';
            session.challenge = undefined;
            session.requestPath = undefined;
            session.phase = 'complete';
        }
        peer.context[SESSION_CONTEXT_KEY] = undefined;
    },
});
