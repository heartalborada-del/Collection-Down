import { ApiResponse } from "~~/types/api/root";
import type { LotteryListItem } from "~~/types/api/bili/types";
import { FetchHeaders } from "~~/types/global";

export default defineEventHandler(async (event) => {
    try {
        const actId = getQuery(event)?.act_id as string | undefined;
        if (!actId) {
            return new ApiResponse<null>(-1, 'Invalid act_id parameter');
        }
        return await fetch(`https://api.bilibili.com/x/vas/dlc_act/asset_bag?act_id=${actId}`, { headers: FetchHeaders }).then((resp) => {
            if (resp.status !== 200) {
                return new ApiResponse<null>(-1, `Failed to fetch data, status code: ${resp.status}`);
            }
            return resp.json().then(data => {
                const lists = data as ApiResponse<{
                    lottery_simple_list: LotteryListItem[]
                }>;
                if (lists.code !== 0)
                    return new ApiResponse<null>(lists.code, `Bilibili api error, msg: ${lists.message}`);
                if (!lists.data)
                    return new ApiResponse<null>(-1, `Failed to fetch data`);
                const newList: LotteryListItem[] = [];
                for (const item of lists.data.lottery_simple_list) {
                    if (item.lottery_id !== 0) {
                        newList.push(item);
                    }
                }
                return new ApiResponse<LotteryListItem[]>(0, undefined, newList);
            }).catch((e) => {
                throw e
            })
        }).catch((e) => {
            throw e
        });
    } catch {
        setResponseStatus(event, 500);
        return new ApiResponse<null>(-1, `An error occurred while fetching data.`);
    }
})