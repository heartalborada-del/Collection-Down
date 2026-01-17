import { ApiResponse } from "~~/types/api/root";
import type { LotteryListItem } from "~~/types/api/bili/types";
import { FetchHeaders } from "~~/types/global";

export default defineEventHandler(async (event) => {
    const { isDev } = useRuntimeConfig();
    try {
        const actId = getQuery(event)?.act_id as string | undefined;
        if (!actId) {
            setResponseStatus(event, 400);
            return new ApiResponse<null>(-1, 'Invalid act_id parameter');
        }
        try {
            const resp = await fetch(`https://api.bilibili.com/x/vas/dlc_act/asset_bag?act_id=${actId}`, { headers: FetchHeaders });
            if (resp.status !== 200) {
                setResponseStatus(event, resp.status || 502);
                return new ApiResponse<null>(-1, `Failed to fetch data, status code: ${resp.status}`);
            }
            const data = await resp.json();
            const lists = data as ApiResponse<{
                lottery_simple_list: LotteryListItem[]
            }>;
            if (lists.code !== 0) {
                setResponseStatus(event, 502);
                return new ApiResponse<null>(lists.code, `Bilibili api error, msg: ${lists.message}`);
            }
            if (!lists.data) {
                setResponseStatus(event, 502);
                return new ApiResponse<null>(-1, `Failed to fetch data`);
            }
            const newList: LotteryListItem[] = [];
            for (const item of lists.data.lottery_simple_list) {
                if (item.lottery_id !== 0) {
                    newList.push(item);
                }
            }
            setResponseStatus(event, 200);
            return new ApiResponse<LotteryListItem[]>(0, undefined, newList);
        } catch (e) {
            if (isDev) {
                setHeaders(event, { 'X-Error-Detail': e instanceof Error ? e.message : String(e) });
            }
            setResponseStatus(event, 500);
            return new ApiResponse<null>(-1, "An unexpected error occurred")
        }
    } catch (e) {
        if (isDev && e instanceof Error) {
            setHeaders(event, { 'X-Error-Detail': e.message });
        }
        setResponseStatus(event, 500);
        return new ApiResponse<null>(-1, `An error occurred while fetching data.`);
    }
})