export default defineEventHandler(async (event) => {
    if(!event.context.params || !event.context.params.route)
        return {
            code: -1,
            msg: 'Invaild',
        };
    const query = getQuery(event);
    const queryStringParts: string[] = [];
    for (const key in query) {
        const value = query[key];
        if (Array.isArray(value)) {
            value.forEach(val => {
                queryStringParts.push(`${key}=${encodeURIComponent(val)}`);
            });
        } else if (typeof value === 'object' && value !== null) {
            queryStringParts.push(`${key}=${encodeURIComponent(JSON.stringify(value))}`);
        } else if(value !== undefined && value !== null) {
            queryStringParts.push(`${key}=${encodeURIComponent(value)}`);
        }
    }
    const rebuiltQueryString = queryStringParts.join('&');
    try {
        const resp = await $fetch(
            `https://api.bilibili.com/x/${event.context.params.route}?${rebuiltQueryString}`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.1901.183',
                    'Referer': 'https://www.bilibili.com/'
                }
            }
        );
        return resp;
    } catch {
        return {
            code: 404,
            msg: 'An error occurred while fetching data',
        };
    }
})