export default defineEventHandler(async (event) => {
    if(!event.context.params || !event.context.params.route)
        return {
            code: -1,
            msg: 'Invaild',
        };
    try {
        const resp = await $fetch(
            `https://i0.hdslb.com/${event.context.params.route}`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.1901.183',
                    'Referer': 'https://www.bilibili.com/'
                }
            }
        );
        return resp;
    } catch (error) {
        return {
            code: 404,
            msg: 'An error occurred while fetching data',
        };
    }
})