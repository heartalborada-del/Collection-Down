import {ApiResponse} from "~~/types/api/root";
import type {BiliCardInfo, BiliRedeemInfo} from "~~/types/api/bili/types";
import type {CardInfo, RedeemInfo} from "~~/types/api/inner/types";
import {FetchHeaders} from "~~/types/global";

export default defineEventHandler(async (event) => {
    try {
        const query = getQuery(event)
        const actId = query?.act_id as string | undefined;
        const lotteryId = query?.lottery_id as string | undefined;
        if (!lotteryId || !actId) {
            return new ApiResponse<null>(-1, "Invalid act_id or lottery_id parameter")
        }
        return await fetch(`https://api.bilibili.com/x/vas/dlc_act/asset_bag?act_id=${actId}&lottery_id=${lotteryId}`, {headers: FetchHeaders}).then((resp) => {
            if (resp.status !== 200) {
                return new ApiResponse<null>(-1, `Failed to fetch data, status code: ${resp.status}`);
            }
            return resp.json().then(data => {
                const origin = data as ApiResponse<{
                    item_list: {
                        item_type: number,
                        card_item: BiliCardInfo
                    }[]
                    collect_list: BiliRedeemInfo[]
                }>
                if (origin.code !== 0)
                    return new ApiResponse<null>(origin.code, `Bilibili api error, msg: ${origin.message}`);
                if (!origin.data)
                    return new ApiResponse<null>(-1, `Failed to fetch data`);
                const items: CardInfo[] = [];
                const redeems: RedeemInfo[] = [];
                for (const item of origin.data.item_list) {
                    if (item.item_type !== 1)
                        continue;
                    items.push({
                        type: item.item_type,
                        id: item.card_item.card_type_id,
                        name: item.card_item.card_name,
                        img: item.card_item.card_img,
                        video: item.card_item.video_list,
                        resolution: {
                            width: item.card_item.width,
                            height: item.card_item.height
                        }
                    });
                }
                for (const redeem of origin.data.collect_list) {
                    let ids = redeem.redeem_item_id?.split("&")
                    if (ids && ids.length === 1 && ids[0] === "") ids = undefined
                    redeems.push({
                        type: redeem.redeem_item_type,
                        name: redeem.redeem_item_name,
                        image: redeem.redeem_item_image,
                        ids: ids
                    })
                }
                return new ApiResponse<{
                    items: CardInfo[],
                    redeems: RedeemInfo[],
                }>(0, undefined, {
                    items: items,
                    redeems: redeems
                });
            }).catch((e) => {
                return new ApiResponse<null>(-1, 'An error occurred while fetching data');
            })
        }).catch((e) => {
            return new ApiResponse<null>(-1, 'An error occurred while fetching data');
        })
    } catch {
        return new ApiResponse<null>(-1, 'An error occurred while fetching data');
    }
})
