import { ApiResponse } from "~~/types/api/root";
import type { BiliEmojiPackageInfo } from "~~/types/api/bili/types";
import { EmojiInfo, EmojiPackageInfo } from "~~/types/api/inner/types";
import { PartIdType } from "~~/types/api/enum";
import { describeError, describeUpstreamResponse } from "~~/server/utils/apiError";
import { createBilibiliDebugResponse, fetchBilibiliApi, getBilibiliFetchRuntime, isBilibiliPowChallengeResponse } from "~~/server/utils/bilibiliFetch";

export default defineEventHandler(async (event) => {
    const bilibiliRuntime = getBilibiliFetchRuntime(event);
    try {
        const query = getQuery(event)
        const packageId = query?.package_id as string | undefined;
        if (!packageId) {
            setResponseStatus(event, 400);
            return new ApiResponse<null>(-1, "Invalid package_id parameter")
        }
        const resp = await fetchBilibiliApi(
            `https://api.bilibili.com/x/garb/v2/user/suit/benefit?item_id=${packageId}&part=emoji_package`,
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
            return new ApiResponse<null>(-1, await describeUpstreamResponse(resp, 'Bilibili emoji package API'));
        }
        const data = await resp.json() as ApiResponse<{
            name: string;
            part_id: number;
            suit_items: {
                emoji: BiliEmojiPackageInfo[];
            };
        }>;
        if (data.code !== 0) {
            setResponseStatus(event, 502);
            return new ApiResponse<null>(data.code, `Bilibili api error, msg: ${data.message}`);
        }
        if (!data.data) {
            setResponseStatus(event, 502);
            return new ApiResponse<null>(-1, 'Bilibili emoji package API returned no data');
        }
        if (!(data.data.part_id === PartIdType.ANIMATED_EMOJI_PACKAGE || data.data.part_id === PartIdType.STATIC_EMOJI_PACKAGE)) {
            setResponseStatus(event, 400);
            return new ApiResponse<null>(-1, `The provided package_id does not correspond to an emoji package`);
        }
        const emojiList: EmojiInfo[] = [];
        for (const emoji of data.data.suit_items.emoji) {
            emojiList.push(new EmojiInfo({
                item_id: emoji.itemId,
                name: emoji.name,
                images: {
                    static: emoji.properties.image,
                    gif: emoji.properties.image_gif,
                    webp: emoji.properties.image_webp,
                }
            }))
        }
        setResponseStatus(event, 200);
        return new ApiResponse<EmojiPackageInfo>(0, undefined, new EmojiPackageInfo({
            name: data.data.name,
            item_id: packageId as unknown as number,
            emojis: emojiList,
        }));
    } catch (e) {
        setResponseStatus(event, 500);
        return new ApiResponse<null>(-1, describeError(e, 'Failed to load emoji package'))
    } finally {
        bilibiliRuntime.tcpClient.close();
    }
})
