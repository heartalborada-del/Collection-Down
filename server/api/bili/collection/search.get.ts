import { ApiResponse } from "~~/types/api/root";
import type { BiliSuitMallSearchItem } from "~~/types/api/bili/types";
import { FetchHeaders } from "~~/types/global";
import { PartIdType } from "~~/types/api/enum";
import type { SearchInfo } from "~~/types/api/inner/types";

export default defineEventHandler(async (event) => {
    try {
        const { isDev } = useRuntimeConfig();
        const keyWord = getQuery(event)?.key_word as string;
        const page = getQuery(event)?.page ? getQuery(event)?.page as string : "1";
        if (!keyWord) {
            setResponseStatus(event, 400);
            return new ApiResponse<null>(-1, 'Invalid key_word parameter');
        }
        const resp = await fetch(`https://api.bilibili.com/x/garb/v2/mall/home/search?key_word=${keyWord}&pn=${page}`, { headers: FetchHeaders });
        if (resp.status !== 200) {
            setResponseStatus(event, resp.status || 502);
            return new ApiResponse<null>(-1, `Failed to fetch data, status code: ${resp.status}`);
        }
        const raw = await resp.json() as ApiResponse<{ list: BiliSuitMallSearchItem[] }>;
        if (raw.code !== 0) {
            setResponseStatus(event, 502);
            return new ApiResponse<null>(raw.code, `Bilibili api error, msg: ${raw.message}`);
        }
        if (!raw.data) {
            setResponseStatus(event, 502);
            return new ApiResponse<null>(-1, `Failed to fetch data`);
        }
        const list: SearchInfo[] = [];
        for (const item of raw.data.list) {
            if (!(item.properties.type === "ip" || item.properties.type === "dlc_act"))
                continue;
            list.push({
                name: item.name,
                id: item.item_id !== 0 ? item.item_id : parseInt(item.properties.dlc_act_id ? item.properties.dlc_act_id : "0", 10),
                type: item.properties.type === "ip" ? PartIdType.THEME : PartIdType.COLLECTION,
                sub_ids: item.properties.fan_item_ids ? item.properties.fan_item_ids.split(',').map(id => parseInt(id)) : [parseInt(item.properties.dlc_lottery_id ? item.properties.dlc_lottery_id : "0")],
                cover: item.properties.image_cover,
            });
        }
        setResponseStatus(event, 200);
        return new ApiResponse<SearchInfo[]>(0, undefined, list);
    } catch (e) {
        const { isDev } = useRuntimeConfig();
        if (isDev && e instanceof Error) {
            setHeaders(event, { 'X-Error-Detail': e.message });
        }
        setResponseStatus(event, 500);
        return new ApiResponse<null>(-1, 'An error occurred while fetching data');
    }
})