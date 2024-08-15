import { Readable } from 'stream';

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
    let headersMod = new Headers();
    for (const key in event.node.req.headers) {
        if (Object.prototype.hasOwnProperty.call(event.node.req.headers, key)) {
            let value = event.node.req.headers[key];
            if(value === null)
            headersMod.append(key, value);
        }
    }
    headersMod.set('referer', "https://www.bilibili.com/");
    headersMod.set('host', "www.bilibili.com");
    headersMod.delete('cookie');
    headersMod.delete('x-forwarded-for');
    headersMod.delete('x-forwarded-port');
    headersMod.delete('x-forwarded-proto');
    try {
        const response = await fetch(`https://upos-sz-mirrorali.bilivideo.com/${event.context.params.route}?${rebuiltQueryString}`, {
            headers: headersMod
        });
        return response;
    } catch {
        return {
            code: 404,
            msg: 'An error occurred while fetching data',
        };
    }
})