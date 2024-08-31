export default defineEventHandler(async (event) => {
    let path = event._path?.replace(`${event.context.matchedRoute?.path.replace("**","")}`,"")
    if(!path) {
        return
    }
    let range = event.headers.get('range')
    if (range)
        return fetch(
            `https://i0.hdslb.com/${path}`,
            {
                method: event.method,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.1901.183',
                    'Referer': 'https://www.bilibili.com/',
                    'Range': range ? range : ""
                },
            }
        );
    return fetch(
        `https://i0.hdslb.com/${path}`,
        {
            method: event.method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.1901.183',
                'Referer': 'https://www.bilibili.com/',
            },
        }
    );
})