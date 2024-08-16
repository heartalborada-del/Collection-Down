function getAPIUrl(jumpLink: string) {
    if(!jumpLink.startsWith("https://www.bilibili.com/h5/mall/"))
        return null;
    try {
        let params = new URL(jumpLink).searchParams
        let type = isCollection(jumpLink)
        if(typeof type === "boolean" && type) {
            return `/bili/api/vas/dlc_act/act/basic?act_id=${params.get("act_id")}`
        } else if (typeof type === "boolean" && !type) {
            return `/bili/api/garb/v2/mall/suit/detail?item_id=${params.get("id")}`
        }
        return null;
    } catch (e) {
        throw e
    }
}

function isCollection(jumpLink: string) {
    if(!jumpLink.startsWith("https://www.bilibili.com/h5/mall/"))
        return null;
    try {
        let params = new URL(jumpLink).searchParams
        if(params.has("act_id")) {
            return true
        } else if (params.has("id")) {
            return false
        }
        return null;
    } catch (e) {
        throw e
    }
}

function parseRespInfoData(isCollection: boolean, data:any) {
    let m = new Map<string,string>
    if(isCollection) {
        m.set('名称',data['act_title'])
        m.set('开售时间', formatDateWithDefaultOffset(new Date(data['start_time']*1000),""))
    } else {
        m.set('名称',data['name'])
        m.set('开售时间', formatDateWithDefaultOffset(new Date(Date.now() + data['sale_left_time']*1000),""))
    }
    return m
}

function formatDateWithDefaultOffset(date: Date, offset: string = '+0800'): string {
    const padZero = (num: number) => num.toString().padStart(2, '0');

    const year = date.getFullYear();
    const month = padZero(date.getMonth() + 1); // 月份从0开始，所以要加1
    const day = padZero(date.getDate());

    const hours = padZero(date.getHours());
    const minutes = padZero(date.getMinutes());
    const seconds = padZero(date.getSeconds());

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}${offset}`;
}

export {getAPIUrl, isCollection, parseRespInfoData}