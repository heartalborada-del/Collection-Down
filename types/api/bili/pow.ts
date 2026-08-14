export const BILIBILI_POW_REQUIRED_CODE = 41201;
export const BILIBILI_POW_HTTP_STATUS = 428;
export const BILIBILI_POW_MAX_ITERATIONS = 0x4C4B40;
export const BILIBILI_POW_WS_PATH = '/api/bili/pow/ws';
export const BILIBILI_POW_WS_MAX_CHALLENGES = 3;
export const BILIBILI_POW_WS_TIMEOUT_MS = 120_000;

export interface BilibiliPowChallenge {
    token: string;
    q: string;
    r: string;
    expiresAt: number;
    maxIterations: number;
}

export interface BilibiliPowVerificationRequest {
    token: string;
    result: number;
}

export interface BilibiliPowWorkerRequest {
    q: string;
    r: string;
    start: number;
    end: number;
}

export interface BilibiliPowWorkerResponse {
    result?: number;
    error?: string;
}

export interface BilibiliPowWsRequestMessage {
    type: 'request';
    path: string;
}

export interface BilibiliPowWsSolutionMessage {
    type: 'solution';
    token: string;
    result: number;
}

export type BilibiliPowWsClientMessage =
    | BilibiliPowWsRequestMessage
    | BilibiliPowWsSolutionMessage;

export interface BilibiliPowWsChallengeMessage {
    type: 'challenge';
    challenge: BilibiliPowChallenge;
}

export interface BilibiliPowWsResponseMessage {
    type: 'response';
    status: number;
    statusText: string;
    headers: [string, string][];
    body: string;
}

export interface BilibiliPowWsErrorMessage {
    type: 'error';
    message: string;
}

export type BilibiliPowWsServerMessage =
    | BilibiliPowWsChallengeMessage
    | BilibiliPowWsResponseMessage
    | BilibiliPowWsErrorMessage;

export function isBilibiliPowChallenge(value: unknown): value is BilibiliPowChallenge {
    if (!value || typeof value !== 'object') return false;
    const challenge = value as Partial<BilibiliPowChallenge>;
    return typeof challenge.token === 'string'
        && challenge.token.length > 0
        && challenge.token.length <= 8192
        && typeof challenge.q === 'string'
        && challenge.q.length > 0
        && challenge.q.length <= 1024
        && typeof challenge.r === 'string'
        && /^[a-f\d]{64}$/i.test(challenge.r)
        && Number.isFinite(challenge.expiresAt)
        && typeof challenge.maxIterations === 'number'
        && Number.isInteger(challenge.maxIterations)
        && challenge.maxIterations > 0
        && challenge.maxIterations <= BILIBILI_POW_MAX_ITERATIONS;
}
