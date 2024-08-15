export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    if (!body.url ||! body.url.startsWith("https://b23.tv"))
        return {
            code: -1,
            msg: 'Invaild URL',
        };
    try {
        const headers = await fetch(body.url,
            {
                headers: {
                    'referer': 'https://www.bilibili.com/',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.61 Chrome/126.0.6478.61 Not/A)Brand/8  Safari/537.36'
                },
                redirect: "manual"
            }
        ).then(resp => resp.headers);
        if (!headers.has('location'))
            return {
                code: -1,
                msg: 'No redirection',
            };
        return {
            code: 0,
            URL: headers.get('location')
        };
    } catch {
        return {
            code: 404,
            msg: 'An error occurred while fetching data',
        };
    }
})