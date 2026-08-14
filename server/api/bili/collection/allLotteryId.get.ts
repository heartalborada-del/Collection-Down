import { ApiResponse } from "~~/types/api/root";
import type { LotteryListItem } from "~~/types/api/bili/types";
import { describeError, describeUpstreamResponse } from "~~/server/utils/apiError";
import { createBilibiliDebugResponse, fetchBilibiliApi, getBilibiliFetchRuntime, isBilibiliPowChallengeResponse } from "~~/server/utils/bilibiliFetch";

export default defineEventHandler(async (event) => {
    const bilibiliRuntime = getBilibiliFetchRuntime(event);
    try {
        const actId = getQuery(event)?.act_id as string | undefined;
        if (!actId) {
            setResponseStatus(event, 400);
            return new ApiResponse<null>(-1, 'Invalid act_id parameter');
        }
        try {
            const resp = await fetchBilibiliApi(
                `https://api.bilibili.com/x/vas/dlc_act/asset_bag?act_id=${actId}`,
                {},
                bilibiliRuntime,
            );
            if (isBilibiliPowChallengeResponse(resp)) return resp;
            const debugResponse = await createBilibiliDebugResponse(resp, bilibiliRuntime);
            if (debugResponse) {
                setResponseStatus(event, resp.status);
                return debugResponse;
            }
            if (resp.status !== 200) {
                setResponseStatus(event, resp.status || 502);
                return new ApiResponse<null>(-1, await describeUpstreamResponse(resp, 'Bilibili asset bag API'));
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
                return new ApiResponse<null>(-1, 'Bilibili asset bag API returned no data');
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
            setResponseStatus(event, 500);
            return new ApiResponse<null>(-1, describeError(e, 'Failed to load collection lottery list'))
        }
    } catch (e) {
        setResponseStatus(event, 500);
        return new ApiResponse<null>(-1, describeError(e, 'Failed to process collection lottery request'));
    } finally {
        bilibiliRuntime.tcpClient.close();
    }
})
