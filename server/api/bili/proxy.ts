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
        /*         const rangeHeader = getHeader(event, 'range');
                if (rangeHeader && event.method === 'GET') {
                    //precheck with HEAD request
                    const head = await fetch(query.origin as string, {
                        ...fetchPayload,
                        method: "HEAD",
                    });
                    if (!head.ok) {
                        setResponseHeader(event, "X-Error-Message", "Failed to fetch resource for range validation");
                        return setResponseStatus(event, head.status);
                    } else {
                        if (head.headers.get('accept-ranges') === 'bytes') {
                            const contentLength = head.headers.get('content-length');
                            if (contentLength) {
                                const size = parseInt(contentLength, 10)
                                //validate range
                                //maybe throw error
                                const range = rangeHeader.replace(/bytes=/, '').split('-');
                                const s = parseInt(range[0], 10), e = parseInt(range[1], 10);
                                const newRange = RangeValidator.validateRange({
                                    start: isNaN(s) ? 0 : s,
                                    end: isNaN(e) ? size - 1 : e
                                }, size, { maxRangeSize: MAX_RANGE_SIZE, onExceedMax: 'clamp' });
                                if (fetchPayload.headers && newRange) {
                                    fetchPayload = {
                                        ...fetchPayload,
                                        headers: {
                                            ...fetchPayload.headers,
                                            'Range': `bytes=${newRange.start}-${newRange.end}`
                                        }
                                    }
                                }
                            }
                        }
                    }
                } */
        const resp = await fetch(query.origin as string, fetchPayload);
        const headers = new Headers();
        for (const [k, v] of resp.headers) {
            const lowerKey = k.toLowerCase();
            if (lowerKey === 'content-length') {
                //神秘edgeone重写我headers，导致range请求的content-length不正确，所以备份一下原始content-length
                headers.set("X-Length-Backup", v);
                headers.set(k, v);
                continue;
            }
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