import { BiliImgDomains, BiliVideoDomains, FetchHeaders } from "~~/types/global";
import { ApiResponse } from "~~/types/api/root";
import { describeError } from "~~/server/utils/apiError";

function errorResponse(status: number, message: string) {
    return Response.json(new ApiResponse<null>(-1, message), { status });
}

export default defineEventHandler(async (event) => {
    if (!globalThis.URLPattern) {
        await import('urlpattern-polyfill');
    }
    const patterns = [...BiliImgDomains, ...BiliVideoDomains].map(domain => new URLPattern({
        hostname: domain
    }));
    try {
        const query = getQuery(event);
        if (!query || !query.origin) {
            return errorResponse(400, "Missing required origin URL");
        }
        const targetUrl = new URL(query.origin as string);
        const isAllowedDomain = patterns.some(pattern => pattern.test({ hostname: targetUrl.hostname }));
        if (!isAllowedDomain) {
            return errorResponse(403, `Proxy domain is not allowed: ${targetUrl.hostname}`);
        }
        const fetchPayload: RequestInit = {
            headers: {
                ...FetchHeaders,
                // 保底补一个正确的 Accept，避免上游返回非预期空内容
            },
            method: event.method,
        }
        // pass client range header
        if (event.method === 'GET') {
            const rangeHeader = getHeader(event, 'range');
            if (rangeHeader) {
                fetchPayload.headers = {
                    ...fetchPayload.headers,
                    'Range': rangeHeader
                }
            }
        }
        const resp = await fetch(query.origin as string, fetchPayload);
        const headers = new Headers();
        for (const [k, v] of resp.headers) {
            const lowerKey = k.toLowerCase();
            if (lowerKey === 'content-encoding') {
                continue;
            }
            if (lowerKey.startsWith('x-')) {
                continue;
            }
            headers.set(k, v);
        }
        return new Response(resp.body, {
            status: resp.status,
            statusText: resp.statusText,
            headers,
        });
    } catch (err) {
        return errorResponse(500, describeError(err, 'Failed to proxy Bilibili resource'));
    }
})
