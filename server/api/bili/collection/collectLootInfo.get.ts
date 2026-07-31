import { ApiResponse } from "~~/types/api/root";
import type { BiliCardInfo, BiliRedeemInfo } from "~~/types/api/bili/types";
import { CardInfo, RedeemInfo } from "~~/types/api/inner/types";
import type { VideoResolution } from "~~/types/api/inner/types";
import { FetchHeaders } from "~~/types/global";
import { RedeemType } from "~~/types/api/enum";
import { describeError, describeUpstreamResponse } from "~~/server/utils/apiError";

export default defineEventHandler(async (event) => {
    try {
        const query = getQuery(event)
        const actId = query?.act_id as string | undefined;
        const lotteryId = query?.lottery_id as string | undefined;
        if (!lotteryId || !actId) {
            setResponseStatus(event, 400);
            return new ApiResponse<null>(-1, "Invalid act_id or lottery_id parameter")
        }
        try {
            const resp = await fetch(`https://api.bilibili.com/x/vas/dlc_act/asset_bag?act_id=${actId}&lottery_id=${lotteryId}`, { headers: FetchHeaders });
            if (resp.status !== 200) {
                setResponseStatus(event, resp.status || 502);
                return new ApiResponse<null>(-1, await describeUpstreamResponse(resp, 'Bilibili collection details API'));
            }
            const data = await resp.json();
            const origin = data as ApiResponse<{
                item_list: {
                    item_type: number,
                    card_item: BiliCardInfo
                }[]
                collect_list: BiliRedeemInfo[]
            }>
            if (origin.code !== 0) {
                setResponseStatus(event, 502);
                return new ApiResponse<null>(origin.code, `Bilibili api error, msg: ${origin.message}`);
            }
            if (!origin.data) {
                setResponseStatus(event, 502);
                return new ApiResponse<null>(-1, 'Bilibili collection details API returned no data');
            }
            const items: CardInfo[] = [];
            const redeems: RedeemInfo[] = [];
            if (origin.data.item_list) {
                for (const item of origin.data.item_list) {
                    if (item.item_type !== 1)
                        continue;
                    items.push(new CardInfo({
                        type: item.card_item.card_type, // 1: video, 2: image
                        id: item.card_item.card_type_id,
                        name: item.card_item.card_name,
                        img: item.card_item.card_img,
                        video: item.card_item.video_list,
                        resolution: {
                            width: item.card_item.width,
                            height: item.card_item.height
                        } as VideoResolution,
                        watermarked: {
                            img: item.card_item.card_img_download,
                            video: item.card_item.video_list_download
                        }
                    }));
                }
            }
            if (origin.data.collect_list) {
                for (const redeem of origin.data.collect_list) {
                    if (redeem.redeem_item_type === RedeemType.COLLECTION_CARD) {
                        const card = (redeem as { card_item: { card_asset_info: { card_item: BiliCardInfo } } }).card_item.card_asset_info.card_item
                        items.push(new CardInfo({
                            type: card.card_type, // 1: video, 2: image
                            id: card.card_type_id,
                            name: card.card_name,
                            img: card.card_img,
                            video: card.video_list,
                            resolution: {
                                width: card.width,
                                height: card.height
                            } as VideoResolution,
                            watermarked: {
                                img: card.card_img_download,
                                video: card.video_list_download
                            }
                        }))
                        continue
                    }
                    let ids = redeem.redeem_item_id?.split("&")
                    if (ids && ids.length === 1 && ids[0] === "") ids = undefined
                    redeems.push(new RedeemInfo({
                        type: redeem.redeem_item_type,
                        name: redeem.redeem_item_name,
                        image: redeem.redeem_item_image,
                        ids: ids,
                        shared: redeem.lottery_id === 0
                    }))
                }
            }
            setResponseStatus(event, 200);
            return new ApiResponse<{
                items: CardInfo[],
                redeems: RedeemInfo[],
            }>(0, undefined, {
                items: items,
                redeems: redeems
            });
        } catch (e) {
            setResponseStatus(event, 500);
            return new ApiResponse<null>(-1, describeError(e, 'Failed to load collection details'));
        }
    } catch (e) {
        setResponseStatus(event, 500);
        return new ApiResponse<null>(-1, describeError(e, 'Failed to process collection details request'));
    }
})
