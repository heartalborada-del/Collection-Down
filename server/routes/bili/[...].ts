export default defineEventHandler(async (event) => {
    let url = event._path;
    let host = event.headers.get("host")
    if (url && host && url.match(/([^:])(\/\/+)/g)) {
        let newURL = host + url?.replace(/([^:])(\/\/+)/g, '$1/');
        event.node.res.writeHead(302, {
            Location: `http://${newURL}`, // 替换为你想要跳转到的新路径
        });
        return event.node.res.end();
    }
    return {
        code: -1,
        msg: 'Invalid',
        url
    };
})