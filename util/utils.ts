function getAPIUrl(jumpLink: string,apiPrefix = "/bili/ts/api/") {
    if(!jumpLink.startsWith("https://www.bilibili.com/h5/mall/"))
        return null;
    try {
        let params = new URL(jumpLink).searchParams
        let type = isCollection(jumpLink)
        if(typeof type === "boolean" && type) {
            return `${apiPrefix}/api/vas/dlc_act/act/basic?act_id=${params.get("act_id")}`
        } else if (typeof type === "boolean" && !type) {
            return `${apiPrefix}/api/garb/v2/mall/suit/detail?item_id=${params.get("id")}`
        }
        return null;
    } catch (e) {
        throw e
    }
}

function getCollectionAPIUrl(jumpLink: string, lottery: string, apiPrefix = "/bili/ts/api/") {
    let target = getAPIUrl(jumpLink)
    if (!target) return null;
    let params = new URL(jumpLink).searchParams
    return `${apiPrefix}/api/vas/dlc_act/lottery_home_detail?act_id=${params.get("act_id")}&lottery_id=${lottery}`
}

function isCollection(jumpLink: string) {
    if(!jumpLink.startsWith("https://www.bilibili.com/h5/mall/"))
        return null;
    try {
        let params = new URL(jumpLink).searchParams
        if(params.has("act_id") && params.get("act_id") !== "") {
            return true
        } else if (params.has("id") && params.get("id") !== "") {
            return false
        }
        return null;
    } catch (e) {
        throw e
    }
}

function buildJumpLink(node: any) {
    if(node['properties']['type'] === "ip") {
        return `https://www.bilibili.com/h5/mall/suit/detail?id=${node['item_id']}`
    } else if(node['properties']['type'] === "dlc_act") {
        return `https://www.bilibili.com/h5/mall/digital-card/home?act_id=${node['properties']['dlc_act_id']}&lottery_id=${node['properties']['dlc_lottery_id']}`
    }
}

function parseRespInfoData(isCollection = false,data:any) {
    let m = new Map<string,string>
    m.set('名称',data['name'])
    if(isCollection) {
        m.set('开售时间', formatDateWithDefaultOffset(new Date(parseInt(data['properties']['dlc_sale_start_time'], 10) * 1000), "", false))
    } else {
        m.set('开售时间', formatDateWithDefaultOffset(new Date(parseInt(data['properties']['sale_time_begin'], 10) * 1000), "", false))
    }
    return m
}

function formatDateWithDefaultOffset(date: Date, offset: string = '+0800', isShowHour = true): string {
    const padZero = (num: number) => num.toString().padStart(2, '0');

    const year = date.getFullYear();
    const month = padZero(date.getMonth() + 1); // 月份从0开始，所以要加1
    const day = padZero(date.getDate());

    const hours = padZero(date.getHours());
    const minutes = padZero(date.getMinutes());
    const seconds = padZero(date.getSeconds());
    if(isShowHour)
        return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}${offset}`;
    return `${year}/${month}/${day}`;
}

export {getAPIUrl, getCollectionAPIUrl, buildJumpLink, isCollection, parseRespInfoData, formatDateWithDefaultOffset}