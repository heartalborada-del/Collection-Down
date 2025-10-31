import {ApiResponse, type CardInfo, type LotteryListItem, type RedeemInfo} from "~~/types/api/root";

export default defineEventHandler(async (event) => {
    try {
        const query = getQuery(event)
        const actId = query?.act_id as string | undefined;
        const lotteryId = query?.lottery_id as string | undefined;
        if (!lotteryId || !actId) {
            return new ApiResponse<null>(-1,"Invalid act_id or lottery_id parameter")
        }
        return await fetch(`https://api.bilibili.com/x/vas/dlc_act/asset_bag?act_id=${actId}&lottery_id=${lotteryId}`).then((resp) => {
            if (resp.status !== 200) {
                return new ApiResponse<null>(-1, `Failed to fetch data, status code: ${resp.status}`);
            }
            return resp.json().then(data => {
                const origin = data as ApiResponse<{
                    item_list: {
                        item_type: number,
                        card_item: CardInfo
                    }[]
                    collect_list: RedeemInfo[]
                }>
                if (origin.code !== 0)
                    return new ApiResponse<null>(origin.code, `Bilibili api error, msg: ${origin.msg}`);
                if (!origin.data)
                    return new ApiResponse<null>(-1, `Failed to fetch data`);
                const items: CardInfo[] = [];
                const redeems: RedeemInfo[] = [];
                for (const item of origin.data.item_list) {
                    if (item.item_type !== 1)
                        continue;
                    items.push(item.card_item);
                }
                for (const redeem of origin.data.collect_list) {
                    let ids = redeem.redeem_item_id?.split("&")
                    if (ids && ids.length === 1 && ids[1] === "") ids = undefined
                    redeems.push({
                        redeem_item_type: redeem.redeem_item_type,
                        redeem_item_name: redeem.redeem_item_name,
                        redeem_item_image: redeem.redeem_item_image,
                        redeem_item_ids: ids
                    } as RedeemInfo)
                }
                return new ApiResponse<{
                    items: CardInfo[],
                    redeems: RedeemInfo[],
                }>(0, undefined, {
                    items: items,
                    redeems: redeems
                });
            }).catch((e) => {
                throw e
            })
        }).catch((e) => {
            throw e
        })
    } catch {
        return new ApiResponse<null>(-1, 'An error occurred while fetching data');
    }
})
