import {ApiResponse} from "~~/types/api/root";

export default defineEventHandler(async (event) => {
    try {
        // 检查 Content-Type（兼容含 charset 的情况）
        const ct = event.headers.get("content-type") || "";
        if (!ct.startsWith("application/json")) {
            return new ApiResponse<string>(-1, 'Content-Type must be application/json');
        }

        const body = await readBody(event);
        if (!body || !body.origin || !body.origin.startsWith("https://b23.tv"))
            return new ApiResponse<string>(-1, 'Invaild URL');

        const headers = await fetch(body.origin,
            {
                headers: {
                    'referer': 'https://www.bilibili.com/',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.61 Chrome/126.0.6478.61 Not/A)Brand/8  Safari/537.36'
                },
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