import { ApiResponse } from "~~/types/api/root";
import { FetchHeaders } from "~~/types/global";

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event);
        if (!body || !body.origin || !body.origin.startsWith("https://b23.tv")) {
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