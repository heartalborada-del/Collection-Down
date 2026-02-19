import { BiliImgDomains, BiliVideoDomains, FetchHeaders, MAX_RANGE_SIZE } from "~~/types/global";
import { RangeValidator } from "~~/utils/rangeValidator";
export default defineEventHandler(async (event) => {
    try {
        const query = getQuery(event);
        if (!query || !query.origin) {
            setResponseHeader(event, "X-Error-Message", "Invalid request payload");
            return setResponseStatus(event, 400);
        }
        const url = URL.parse(query.origin as string);
        let isAllowedDomain = false;
        for (const domain of [...BiliImgDomains, ...BiliVideoDomains]) {
            if (url?.host === domain) {
                isAllowedDomain = true;
                break;
            }
        }
        if (!isAllowedDomain) {
            setResponseHeader(event, "X-Error-Message", "Domain not allowed");
            return setResponseStatus(event, 403);
        }
        let fetchPayload: RequestInit = {
            headers: {
                ...FetchHeaders
            },
            method: event.method,
        }
        const rangeHeader = getHeader(event, 'range');
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
        }
        const resp = await fetch(query.origin as string, fetchPayload);
        for (const [k, v] of resp.headers) {
            if (k.toLowerCase() === 'content-length') {
                //神秘edgeone重写我headers，导致range请求的content-length不正确，所以备份一下原始content-length
                setResponseHeader(event, "X-Length-Backup", v);
                setResponseHeader(event, "Content-Length", 0);
            }
            setResponseHeader(event, k, v as string);
        }
        setResponseStatus(event, resp.status);
        const buffer = await resp.arrayBuffer();
        return Buffer.from(buffer);
    } catch (err) {
        setResponseHeader(event, "X-Error-Message", `An error occurred while fetching data.`);
        setResponseHeader(event, "X-Error-Message", (err as Error).message);
        return setResponseStatus(event, 500);
    }
})