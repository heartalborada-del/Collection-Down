import {ApiResponse} from "~~/types/api/root";
import {FetchHeaders} from "~~/types/global";
import type {BiliEmojiPackageInfo} from "~~/types/api/bili/types";
import type {EmojiInfo, EmojiPackageInfo} from "~~/types/api/inner/types";
import {PartIdType} from "~~/types/api/enum";

export default defineEventHandler(async (event) => {
    try {
        const query = getQuery(event)
        const packageId = query?.package_id as string | undefined;
        if (!packageId) {
            return new ApiResponse<null>(-1, "Invalid package_id parameter")
        }
        const resp = await fetch(`https://api.bilibili.com/x/garb/v2/user/suit/benefit?item_id=${packageId}&part=emoji_package`, {headers:FetchHeaders}).then((resp) => {
            return resp;
        })
        if (resp.status !== 200) {
            return new ApiResponse<null>(-1, `Failed to fetch data, status code: ${resp.status}`);
        }
        const data = await resp.json() as ApiResponse<{
            name: string;
            part_id: number;
            suit_items: {
                emoji: BiliEmojiPackageInfo[];
            };
        }>;
        if (data.code !== 0)
            return new ApiResponse<null>(data.code, `Bilibili api error, msg: ${data.message}`);
        if (!data.data)
            return new ApiResponse<null>(-1, `Failed to fetch data`);
        if (!(data.data.part_id === PartIdType.ANIMATED_EMOJI_PACKAGE || data.data.part_id === PartIdType.STATIC_EMOJI_PACKAGE) ){
            return new ApiResponse<null>(-1, `The provided package_id does not correspond to an emoji package`);
        }
        const emojiList: EmojiInfo[] = [];
        for (const emoji of data.data.suit_items.emoji) {
            emojiList.push({
                itemId: emoji.itemId,
                name: emoji.name,
                images: {
                    static: emoji.properties.image,
                    gif: emoji.properties.image_gif,
                    webp: emoji.properties.image_webp,
                }
            })
        }
        return new ApiResponse<EmojiPackageInfo>(0, undefined, {
            name: data.data.name,
            item_id: packageId as unknown as number,
            emojis: emojiList,
        });
    } catch {
        return new ApiResponse<null>(-1, "An unexpected error occurred")
    }
})