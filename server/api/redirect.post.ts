import { ApiResponse } from "~~/types/api/root";
import { FetchHeaders } from "~~/types/global";

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
                return new ApiResponse<string>(-1, 'No redirection');
            }

            setResponseStatus(event, 200);
            return new ApiResponse<string>(0, undefined, headers.get('location') || '');
        } catch (e) {
            if (useRuntimeConfig().isDev && e instanceof Error) {
                setHeaders(event, { 'X-Error-Detail': e.message });
            }
            setResponseStatus(event, 500);
            return new ApiResponse<string>(-1, 'An error occurred while fetching data');
        }
    } catch {
        setResponseStatus(event, 500);
        return new ApiResponse<string>(-1, 'An error occurred while fetching data');
    }
})