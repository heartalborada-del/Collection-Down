import { BiliImgDomains, BiliVideoDomains, FetchHeaders } from "~~/types/global";

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
            setResponseHeader(event, "X-Error-Message", "Invalid request payload");
            return setResponseStatus(event, 400);
        }
        const targetUrl = new URL(query.origin as string);
        const isAllowedDomain = patterns.some(pattern => pattern.test({ hostname: targetUrl.hostname }));
        if (!isAllowedDomain) {
            setResponseHeader(event, "X-Error-Message", "Domain not allowed");
            return setResponseStatus(event, 403);
        }
        const { host, accpet, ...restFetchHeaders } = FetchHeaders;
        const fetchPayload: RequestInit = {
            headers: {
                ...restFetchHeaders,
                // 保底补一个正确的 Accept，避免上游返回非预期空内容
                Accept: accpet || '*/*',
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
        setResponseHeader(event, "X-Error-Message", `An error occurred while fetching data.`);
        setResponseHeader(event, "X-Error-Message", (err as Error).message);
        return setResponseStatus(event, 500);
    }
})