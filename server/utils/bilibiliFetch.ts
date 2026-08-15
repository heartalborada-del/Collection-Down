import { getCookie, type H3Event } from 'h3';
import { FetchHeaders } from "~~/types/global";
import { ApiResponse } from "~~/types/api/root";
import {
    BILIBILI_POW_HTTP_STATUS,
    BILIBILI_POW_MAX_ITERATIONS,
    BILIBILI_POW_REQUIRED_CODE,
    type BilibiliPowChallenge,
} from "~~/types/api/bili/pow";
import { extractWbiKey, signWbiUrl, type WbiKeys } from "~~/server/utils/bilibiliWbi";
import { BilibiliTcpClient } from "~~/server/utils/bilibiliTcpFetch";

const BILIBILI_FINGERPRINT_URL = 'https://api.bilibili.com/x/frontend/finger/spi';
const BILIBILI_WBI_NAV_URL = 'https://api.bilibili.com/x/web-interface/nav';
const BILIBILI_CHALLENGE_PAGE_URL = 'https://www.bilibili.com/video/BV1GJ411x7h7';
const BILIBILI_CAPTCHA_URL = 'https://security.bilibili.com/th/captcha/cc/check';
const FINGERPRINT_TTL_MS = 6 * 60 * 60 * 1000;
const SECURITY_TOKEN_TTL_MS = 30 * 60 * 1000;
const WBI_KEY_TTL_MS = 60 * 60 * 1000;
const POW_REQUEST_CONTEXT_TTL_MS = 10 * 60 * 1000;
const MAX_POW_REQUEST_CONTEXTS = 64;
const BILIBILI_POW_RESPONSE_HEADER = 'x-collection-down-bilibili-pow';

export const BILIBILI_SECURITY_COOKIE = 'collection_down_bili_sec';

interface FingerprintResponse {
    code?: number;
    data?: {
        b_3?: string;
        b_4?: string;
    };
}

interface CaptchaPayload {
    q?: unknown;
    r?: unknown;
    type?: unknown;
    verity?: unknown;
    exp?: unknown;
}

interface CaptchaResponse {
    code?: number;
    message?: string;
}

interface WbiNavResponse {
    code?: number;
    data?: {
        wbi_img?: {
            img_url?: string;
            sub_url?: string;
        };
    };
}

interface CachedValue<T = string> {
    value: T;
    expiresAt: number;
}

interface PowRequestContext {
    apiUrl: string;
    client: BilibiliTcpClient;
    fingerprintCookie?: string;
    token: string;
    expiresAt: number;
    timeout: ReturnType<typeof setTimeout>;
}

export interface BilibiliFetchRuntime {
    securityToken?: string;
    debugResponses: boolean;
    tcpClient: BilibiliTcpClient;
}

export type BilibiliPowVerificationResult = {
    ok: true;
    securityToken: string;
    maxAgeSeconds: number;
} | {
    ok: false;
    status: number;
    message: string;
    retryable?: boolean;
};

export interface BilibiliDebugResponse {
    debug: true;
    upstream: {
        url: string;
        status: number;
        statusText: string;
        redirected: boolean;
        headers: [string, string][];
        body: string;
        json?: unknown;
    };
}

let cachedFingerprint: CachedValue | undefined;
let cachedWbiKeys: CachedValue<WbiKeys> | undefined;
const pendingPowRequests = new Map<string, PowRequestContext>();

type BilibiliLogLevel = 'info' | 'warn';

function logBilibili(level: BilibiliLogLevel, event: string, details: Record<string, unknown>): void {
    const entry = {
        message: `bilibili-api:${event}`,
        scope: 'bilibili-api',
        event,
        ...details,
    };
    if (level === 'warn') {
        console.warn(entry);
    } else {
        console.info(entry);
    }
}

function getEndpoint(input: string | URL): string {
    try {
        return new URL(input).pathname;
    } catch {
        return String(input).split('?')[0] || 'unknown';
    }
}

function getCachedValue<T>(cached: CachedValue<T> | undefined): T | undefined {
    return cached && cached.expiresAt > Date.now() ? cached.value : undefined;
}

function prunePowRequestContexts(now = Date.now()): void {
    for (const [id, context] of pendingPowRequests) {
        if (context.expiresAt <= now) discardPowRequestContext(id);
    }
    while (pendingPowRequests.size >= MAX_POW_REQUEST_CONTEXTS) {
        const oldestId = pendingPowRequests.keys().next().value;
        if (typeof oldestId !== 'string') break;
        discardPowRequestContext(oldestId);
    }
}

function discardPowRequestContext(id: string): void {
    const context = pendingPowRequests.get(id);
    if (!context) return;
    pendingPowRequests.delete(id);
    clearTimeout(context.timeout);
    context.client.close();
}

function cachePowRequestContext(
    token: string,
    apiUrl: string | URL,
    client: BilibiliTcpClient,
    ttlMs: number,
    fingerprintCookie?: string,
): string {
    prunePowRequestContexts();
    const id = crypto.randomUUID();
    const timeout = setTimeout(() => discardPowRequestContext(id), ttlMs);
    if (typeof timeout === 'object' && 'unref' in timeout) timeout.unref();
    pendingPowRequests.set(id, {
        apiUrl: new URL(apiUrl).toString(),
        client,
        fingerprintCookie,
        token,
        expiresAt: Date.now() + ttlMs,
        timeout,
    });
    return id;
}

function consumePowRequestContext(id: string, token: string): PowRequestContext | undefined {
    prunePowRequestContexts();
    const context = pendingPowRequests.get(id);
    if (!context || context.token !== token) return undefined;
    pendingPowRequests.delete(id);
    clearTimeout(context.timeout);
    return context;
}

function mergeHeaders(headers?: HeadersInit): Headers {
    const merged = new Headers(FetchHeaders);
    if (headers) {
        new Headers(headers).forEach((value, key) => merged.set(key, value));
    }
    if (!merged.has('origin')) {
        merged.set('origin', 'https://www.bilibili.com');
    }
    // Host must come from the request URL. A mismatched Host is rejected by Bilibili.
    merged.delete('host');
    return merged;
}

function applyManagedCookies(headers: Headers, fingerprint?: string, securityToken?: string): void {
    const cookies = [
        headers.get('cookie'),
        fingerprint,
        securityToken ? `X-BILI-SEC-TOKEN=${securityToken}` : undefined,
    ].filter((cookie): cookie is string => Boolean(cookie));
    if (cookies.length > 0) {
        headers.set('cookie', cookies.join('; '));
    }
}

async function loadFingerprintCookie(traceId: string): Promise<string | undefined> {
    const cached = getCachedValue(cachedFingerprint);
    if (cached) return cached;
    logBilibili('info', 'fingerprint_request_started', {
        traceId,
    });
    try {
        const headers = mergeHeaders();
        const response = await fetch(BILIBILI_FINGERPRINT_URL, { headers });
            if (!response.ok) {
                logBilibili('warn', 'fingerprint_response', {
                    traceId,
                    status: response.status,
                });
                return undefined;
            }
            const payload = await response.json() as FingerprintResponse;
            const buvid3 = payload.data?.b_3;
            const buvid4 = payload.data?.b_4;
            if (payload.code !== 0 || !buvid3 || !buvid4) {
                logBilibili('warn', 'fingerprint_invalid', {
                    traceId,
                    code: payload.code ?? null,
                    hasBuvid3: Boolean(buvid3),
                    hasBuvid4: Boolean(buvid4),
                });
                return undefined;
            }

            const cookie = `buvid3=${buvid3}; buvid4=${buvid4}`;
            cachedFingerprint = {
                value: cookie,
                expiresAt: Date.now() + FINGERPRINT_TTL_MS,
            };
            logBilibili('info', 'fingerprint_refreshed', {
                traceId,
                status: response.status,
                ttlSeconds: FINGERPRINT_TTL_MS / 1000,
            });
        return cookie;
    } catch (error) {
        logBilibili('warn', 'fingerprint_error', {
            traceId,
            errorType: error instanceof Error ? error.name : 'UnknownError',
        });
        return undefined;
    }
}

async function loadWbiKeys(
    traceId: string,
    fingerprintCookie?: string,
    securityToken?: string,
): Promise<WbiKeys | undefined> {
    const cached = getCachedValue(cachedWbiKeys);
    if (cached) {
        return cached;
    }
    logBilibili('info', 'wbi_keys_request_started', { traceId });
    try {
        const headers = mergeHeaders();
        applyManagedCookies(headers, fingerprintCookie, securityToken);
        // WBI traffic is independent of the short-lived API -> Security socket.
        const response = await fetch(BILIBILI_WBI_NAV_URL, { headers });
            if (!response.ok) {
                logBilibili('warn', 'wbi_keys_response', {
                    traceId,
                    status: response.status,
                });
                return undefined;
            }

            const payload = await response.json() as WbiNavResponse;
            const imgKey = extractWbiKey(payload.data?.wbi_img?.img_url ?? '');
            const subKey = extractWbiKey(payload.data?.wbi_img?.sub_url ?? '');
            if ((payload.code !== 0 && payload.code !== -101) || !imgKey || !subKey) {
                logBilibili('warn', 'wbi_keys_invalid', {
                    traceId,
                    code: payload.code ?? null,
                    hasImgKey: Boolean(imgKey),
                    hasSubKey: Boolean(subKey),
                });
                return undefined;
            }

            const keys = { imgKey, subKey };
            cachedWbiKeys = {
                value: keys,
                expiresAt: Date.now() + WBI_KEY_TTL_MS,
            };
            logBilibili('info', 'wbi_keys_refreshed', {
                traceId,
                ttlSeconds: WBI_KEY_TTL_MS / 1000,
            });
        return keys;
    } catch (error) {
        logBilibili('warn', 'wbi_keys_error', {
            traceId,
            errorType: error instanceof Error ? error.name : 'UnknownError',
        });
        return undefined;
    }
}

function extractSecurityToken(response: Response): string | undefined {
    const setCookie = response.headers.get('set-cookie');
    if (!setCookie) {
        return undefined;
    }
    const marker = 'x-bili-sec-token=';
    const markerIndex = setCookie.toLowerCase().indexOf(marker);
    if (markerIndex < 0) {
        return undefined;
    }

    const rawValue = setCookie
        .slice(markerIndex + marker.length)
        .split(';', 1)[0]
        ?.trim();
    if (!rawValue) {
        return undefined;
    }

    const valueParts = rawValue.split(',').map(value => value.trim()).filter(Boolean);
    return valueParts.find(value => value.split('.').length === 3)
        ?? valueParts.at(-1);
}

function getChallengeResponseDetails(response: Response, token?: string): Record<string, unknown> {
    return {
        status: response.status,
        hasChallengeToken: Boolean(token),
        setCookiePresent: response.headers.has('set-cookie'),
        setCookieLength: response.headers.get('set-cookie')?.length ?? 0,
        challengeTokenLength: token?.length ?? 0,
        challengeTokenSegments: token?.split('.').length ?? 0,
        responseHeaderNames: [...response.headers.keys()].sort(),
    };
}

async function requestSecurityChallengeToken(
    traceId: string,
    fingerprintCookie: string | undefined,
    client: BilibiliTcpClient,
): Promise<string | undefined> {
    const headers = mergeHeaders({
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
    });
    headers.delete('origin');
    applyManagedCookies(headers, fingerprintCookie);
    const response = await client.fetch(BILIBILI_CHALLENGE_PAGE_URL, {
        headers,
    });
    const token = extractSecurityToken(response);
    logBilibili(token ? 'info' : 'warn', 'challenge_page_response', {
        traceId,
        sameConnectionId: client.getStats().lastApiConnectionId === client.getStats().lastResponseConnectionId,
        ...getChallengeResponseDetails(response, token),
    });
    return token;
}

function decodeCaptchaPayload(token: string): CaptchaPayload | undefined {
    if (token.length === 0 || token.length > 8192) {
        return undefined;
    }
    try {
        const encoded = token.split('.')[1];
        if (!encoded) {
            return undefined;
        }
        const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
        const binary = atob(padded);
        const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes)) as CaptchaPayload;
    } catch {
        return undefined;
    }
}

type ParsedPowChallenge = Omit<BilibiliPowChallenge, 'id'>;

function parsePowChallenge(token: string): ParsedPowChallenge | undefined {
    const payload = decodeCaptchaPayload(token);
    if (
        typeof payload?.q !== 'string'
        || payload.q.length === 0
        || payload.q.length > 1024
        || typeof payload.r !== 'string'
        || !/^[a-f\d]{64}$/i.test(payload.r)
        || String(payload.type) !== '1'
        || Number(payload.verity) !== 0
        || !Number.isInteger(Number(payload.exp))
    ) {
        return undefined;
    }

    const expiresAt = Number(payload.exp) * 1000;
    if (expiresAt <= Date.now()) {
        return undefined;
    }
    return {
        token,
        q: payload.q,
        r: payload.r.toLowerCase(),
        expiresAt,
        maxIterations: BILIBILI_POW_MAX_ITERATIONS,
    };
}

function createClientPowResponse(
    token: string,
    apiUrl: string | URL,
    client: BilibiliTcpClient,
    fingerprintCookie?: string,
): Response | undefined {
    const challenge = parsePowChallenge(token);
    if (!challenge) return undefined;
    const connectionTtlMs = Math.max(
        1,
        Math.min(POW_REQUEST_CONTEXT_TTL_MS, challenge.expiresAt - Date.now()),
    );
    client.holdForFinalRequest(connectionTtlMs);
    const id = cachePowRequestContext(token, apiUrl, client, connectionTtlMs, fingerprintCookie);
    return Response.json(
        new ApiResponse<BilibiliPowChallenge>(
            BILIBILI_POW_REQUIRED_CODE,
            'Bilibili proof of work is required',
            { id, ...challenge },
        ),
        {
            status: BILIBILI_POW_HTTP_STATUS,
            headers: {
                'cache-control': 'no-store',
                [BILIBILI_POW_RESPONSE_HEADER]: '1',
            },
        },
    );
}

async function createCachedPowResponse(
    traceId: string,
    apiUrl: string | URL,
    init: RequestInit,
    headers: Headers,
    fingerprintCookie?: string,
): Promise<Response | undefined> {
    const client = new BilibiliTcpClient();
    try {
        const apiResponse = await client.fetch(apiUrl, { ...init, headers });
        // BilibiliTcpClient resolves only after its parser has buffered the complete response.
        const apiToken = extractSecurityToken(apiResponse);
        logBilibili(apiToken ? 'info' : 'warn', 'challenge_api_response', {
            traceId,
            endpoint: getEndpoint(apiUrl),
            ...getChallengeResponseDetails(apiResponse, apiToken),
            connectionId: client.getStats().lastApiConnectionId,
        });
        const token = apiToken
            ?? (apiResponse.status === 412
                ? await requestSecurityChallengeToken(traceId, fingerprintCookie, client)
                : undefined);
        if (!token) {
            client.close();
            return apiResponse;
        }
        logBilibili('info', 'challenge_connection_created', {
            traceId,
            endpoint: getEndpoint(apiUrl),
            connectionId: client.getStats().lastApiConnectionId,
            requestsCompleted: client.getStats().requestsCompleted,
        });
        const response = createClientPowResponse(token, apiUrl, client, fingerprintCookie);
        if (!response) client.close();
        return response;
    } catch (error) {
        client.close();
        logBilibili('warn', 'challenge_connection_error', {
            traceId,
            endpoint: getEndpoint(apiUrl),
            errorType: error instanceof Error ? error.name : 'UnknownError',
        });
        return undefined;
    }
}

function isPowResultInRange(challenge: ParsedPowChallenge, result: number): boolean {
    return Number.isInteger(result) && result >= 0 && result < challenge.maxIterations;
}

export function isBilibiliPowChallengeResponse(response: Response): boolean {
    return response.status === BILIBILI_POW_HTTP_STATUS
        && response.headers.get(BILIBILI_POW_RESPONSE_HEADER) === '1';
}

export async function verifyBilibiliPowChallenge(
    token: string,
    result: number,
    challengeId: string,
    runtime?: BilibiliFetchRuntime,
): Promise<BilibiliPowVerificationResult> {
    const traceId = crypto.randomUUID();
    const challenge = parsePowChallenge(token);
    if (!challenge) {
        logBilibili('warn', 'challenge_verification_invalid', { traceId });
        return { ok: false, status: 400, message: 'Invalid or expired Bilibili security challenge' };
    }
    if (!isPowResultInRange(challenge, result)) {
        logBilibili('warn', 'challenge_solution_out_of_range', { traceId });
        return { ok: false, status: 400, message: 'Bilibili proof-of-work result is out of range' };
    }
    const requestContext = consumePowRequestContext(challengeId, token);
    if (!requestContext) {
        logBilibili('warn', 'challenge_context_invalid', { traceId, challengeId });
        return { ok: false, status: 400, message: 'Bilibili verification request ID is invalid or expired' };
    }

    const activeRuntime = runtime ?? createBilibiliFetchRuntime();
    activeRuntime.tcpClient.close();
    activeRuntime.tcpClient = requestContext.client;
    try {
        logBilibili('info', 'challenge_connection_resumed', {
            traceId,
            challengeId,
            endpoint: getEndpoint(requestContext.apiUrl),
            connectionId: activeRuntime.tcpClient.getStats().lastApiConnectionId,
        });
        const headers = mergeHeaders();
        applyManagedCookies(headers, requestContext.fingerprintCookie, `3,${token}`);
        headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
        const response = await activeRuntime.tcpClient.fetchFinal(BILIBILI_CAPTCHA_URL, {
            method: 'POST',
            headers,
            body: new URLSearchParams({ token, result: String(result) }),
        });
        if (!response.ok) {
            logBilibili('warn', 'challenge_submit_response', { traceId, status: response.status });
            return { ok: false, status: 502, message: 'Bilibili rejected the security verification request' };
        }

        const data = await response.json() as CaptchaResponse;
        if (data.code !== 0) {
            const upstreamMessage = typeof data.message === 'string'
                ? data.message.trim().slice(0, 200)
                : '';
            logBilibili('warn', 'challenge_submit_invalid', {
                traceId,
                status: response.status,
                code: data.code ?? null,
                upstreamMessage: upstreamMessage || null,
            });
            return {
                ok: false,
                status: 502,
                message: upstreamMessage
                    ? `Bilibili did not accept the security verification result: ${upstreamMessage}`
                    : 'Bilibili did not accept the security verification result',
                retryable: upstreamMessage.toLowerCase() === 'bad ip',
            };
        }
        if (typeof data.message !== 'string' || data.message.length === 0 || data.message.length > 8192) {
            logBilibili('warn', 'challenge_submit_token_invalid', {
                traceId,
                status: response.status,
            });
            return { ok: false, status: 502, message: 'Bilibili returned an invalid security token' };
        }

        logBilibili('info', 'challenge_accepted', {
            traceId,
            challengeId,
            status: response.status,
            ttlSeconds: SECURITY_TOKEN_TTL_MS / 1000,
        });
        return {
            ok: true,
            securityToken: data.message,
            maxAgeSeconds: SECURITY_TOKEN_TTL_MS / 1000,
        };
    } catch (error) {
        logBilibili('warn', 'challenge_submit_error', {
            traceId,
            errorType: error instanceof Error ? error.name : 'UnknownError',
        });
        return { ok: false, status: 502, message: 'Unable to verify the Bilibili security challenge' };
    } finally {
        if (!runtime) activeRuntime.tcpClient.close();
    }
}

export function createBilibiliFetchRuntime(event?: H3Event): BilibiliFetchRuntime {
    const cloudflare = event?.context.cloudflare as {
        env?: Record<string, unknown>;
    } | undefined;
    const env = cloudflare?.env;
    return {
        securityToken: event ? getCookie(event, BILIBILI_SECURITY_COOKIE) : undefined,
        debugResponses: env?.BILIBILI_DEBUG_RESPONSES === 'true',
        tcpClient: new BilibiliTcpClient(),
    };
}

export const getBilibiliFetchRuntime = createBilibiliFetchRuntime;

export async function createBilibiliDebugResponse(
    response: Response,
    runtime: BilibiliFetchRuntime,
): Promise<BilibiliDebugResponse | undefined> {
    if (!runtime.debugResponses || isBilibiliPowChallengeResponse(response)) {
        return undefined;
    }

    const body = await response.clone().text();
    let json: unknown;
    try {
        json = JSON.parse(body);
    } catch {
        // The exact response body is still returned for non-JSON upstream responses.
    }

    return {
        debug: true,
        upstream: {
            url: response.url,
            status: response.status,
            statusText: response.statusText,
            redirected: response.redirected,
            headers: [...response.headers.entries()],
            body,
            ...(json === undefined ? {} : { json }),
        },
    };
}

export async function fetchBilibiliApi(
    input: string | URL,
    init: RequestInit = {},
    runtime: BilibiliFetchRuntime,
): Promise<Response> {
    const traceId = crypto.randomUUID();
    const endpoint = getEndpoint(input);
    const headers = mergeHeaders(init.headers);
    const cachedFingerprintCookie = getCachedValue(cachedFingerprint)
        ?? await loadFingerprintCookie(traceId);
    const cachedToken = runtime.securityToken;
    const isGetRequest = !init.method || init.method.toUpperCase() === 'GET';
    const availableWbiKeys = isGetRequest
        ? getCachedValue(cachedWbiKeys)
            ?? await loadWbiKeys(traceId, cachedFingerprintCookie, cachedToken)
        : undefined;
    const requestInput = availableWbiKeys
        ? signWbiUrl(input, availableWbiKeys)
        : input;
    applyManagedCookies(headers, cachedFingerprintCookie, cachedToken);
    logBilibili(availableWbiKeys ? 'info' : 'warn', availableWbiKeys ? 'wbi_signed' : 'wbi_sign_skipped', {
        traceId,
        endpoint,
        phase: 'initial',
    });
    logBilibili('info', 'request_started', {
        traceId,
        endpoint,
        hadCachedFingerprint: Boolean(cachedFingerprintCookie),
        hadCachedSecurityToken: Boolean(cachedToken),
        wbiSigned: Boolean(availableWbiKeys),
    });

    let response: Response;
    try {
        // Ordinary API traffic uses the platform fetch path and never shares the Security socket.
        response = await fetch(requestInput, { ...init, headers });
    } catch (error) {
        logBilibili('warn', 'request_error', {
            traceId,
            endpoint,
            errorType: error instanceof Error ? error.name : 'UnknownError',
        });
        throw error;
    }
    if (response.status !== 412) {
        if (!response.ok) {
            logBilibili('warn', 'upstream_error', {
                traceId,
                endpoint,
                status: response.status,
            });
        }
        return response;
    }

    const responseChallengeToken = extractSecurityToken(response);
    logBilibili('warn', 'precondition_failed', {
        traceId,
        endpoint,
        hadCachedFingerprint: Boolean(cachedFingerprintCookie),
        hadCachedSecurityToken: Boolean(cachedToken),
        ...getChallengeResponseDetails(response, responseChallengeToken),
    });

    const clientResponse = await createCachedPowResponse(
        traceId,
        requestInput,
        init,
        headers,
        cachedFingerprintCookie,
    );
    if (!clientResponse) {
        logBilibili('warn', 'challenge_connection_unavailable', { traceId, endpoint });
        return response;
    }

    try {
        await response.body?.cancel();
    } catch {
        // The client receives a synthetic challenge response instead of the rejected body.
    }
    if (isBilibiliPowChallengeResponse(clientResponse)) {
        logBilibili('info', 'challenge_delegated', {
            traceId,
            endpoint,
            maxConnectionTtlSeconds: POW_REQUEST_CONTEXT_TTL_MS / 1000,
        });
    } else {
        logBilibili('info', 'challenge_replay_completed', {
            traceId,
            endpoint,
            status: clientResponse.status,
        });
    }
    return clientResponse;
}
