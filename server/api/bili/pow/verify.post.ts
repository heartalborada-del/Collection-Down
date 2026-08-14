import { getRequestURL, readBody, setCookie } from 'h3';
import { ApiResponse } from '~~/types/api/root';
import type { BilibiliPowVerificationRequest } from '~~/types/api/bili/pow';
import {
    BILIBILI_SECURITY_COOKIE,
    getBilibiliFetchRuntime,
    verifyBilibiliPowChallenge,
} from '~~/server/utils/bilibiliFetch';

function isVerificationRequest(value: unknown): value is BilibiliPowVerificationRequest {
    if (!value || typeof value !== 'object') return false;
    const request = value as Partial<BilibiliPowVerificationRequest>;
    return typeof request.token === 'string'
        && request.token.length > 0
        && request.token.length <= 8192
        && Number.isInteger(request.result);
}

export default defineEventHandler(async (event) => {
    const bilibiliRuntime = getBilibiliFetchRuntime(event);
    try {
        const body = await readBody<unknown>(event);
    if (!isVerificationRequest(body)) {
        setResponseStatus(event, 400);
        return new ApiResponse<null>(-1, 'Invalid Bilibili proof-of-work submission');
    }

        const verification = await verifyBilibiliPowChallenge(
            body.token,
            body.result,
            bilibiliRuntime,
        );
    if (!verification.ok) {
        setResponseStatus(event, verification.status);
        return new ApiResponse<null>(-1, verification.message);
    }

    setCookie(event, BILIBILI_SECURITY_COOKIE, verification.securityToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: getRequestURL(event).protocol === 'https:',
        path: '/',
        maxAge: verification.maxAgeSeconds,
    });
        setResponseStatus(event, 200);
        return new ApiResponse<null>(0, 'Bilibili security verification completed');
    } finally {
        bilibiliRuntime.tcpClient.close();
    }
});
