import { ApiResponse } from "~~/types/api/root";
import { FetchHeaders } from "~~/types/global";
import { describeError } from "~~/server/utils/apiError";

const ALLOWED_REDIRECT_HOSTS = new Set(["b23.tv"]);

function isAllowedRedirectUrl(origin: unknown): origin is string {
    if (typeof origin !== "string") {
        return false;
    }

    try {
        const url = new URL(origin);
        return url.protocol === "https:"
            && url.port === ""
            && url.username === ""
            && url.password === ""
            && ALLOWED_REDIRECT_HOSTS.has(url.hostname);
    } catch {
        return false;
    }
}

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody<{ origin?: unknown }>(event);
        if (!isAllowedRedirectUrl(body?.origin)) {
            setResponseStatus(event, 400);
            return new ApiResponse<string>(-1, 'Invalid URL');
        }

        try {
            const resp = await fetch(body.origin,
                {
                    headers: FetchHeaders,
                    redirect: "manual"
                }
            );
            const headers = resp.headers;

            if (!headers.has('location')) {
                setResponseStatus(event, 404);
                return new ApiResponse<string>(-1, `b23.tv did not return a redirect location (HTTP ${resp.status} ${resp.statusText})`);
            }

            setResponseStatus(event, 200);
            return new ApiResponse<string>(0, undefined, headers.get('location') || '');
        } catch (e) {
            setResponseStatus(event, 500);
            return new ApiResponse<string>(-1, describeError(e, 'Failed to resolve b23.tv redirect'));
        }
    } catch (e) {
        setResponseStatus(event, 500);
        return new ApiResponse<string>(-1, describeError(e, 'Failed to process redirect request'));
    }
})
