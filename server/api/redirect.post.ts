import {ApiResponse} from "~~/types/api/root";
import {FetchHeaders} from "~~/types/global";

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event);
        if (!body || !body.origin || !body.origin.startsWith("https://b23.tv"))
            return new ApiResponse<string>(-1, 'Invalid URL');

        const headers = await fetch(body.origin,
            {
                headers: FetchHeaders,
                redirect: "manual"
            }
        ).then(resp => resp.headers);

        if (!headers.has('location')) {
            return new ApiResponse<string>(-1, 'No redirection');
        }

        return new ApiResponse<string>(0, undefined,headers.get('location') || '');
    } catch {
        return new ApiResponse<string>(-1, 'An error occurred while fetching data');
    }
})