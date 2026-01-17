import type { BiliEmojiPackageInfo, LoadingProperties, ProgressbarProperties, SkinProperties, ThumbupProperties } from "~~/types/api/bili/types";
import { PartIdType } from "~~/types/api/enum";
import { SkinBackgroundInfo, type SuitComponentResult } from "~~/types/api/inner/types";
import { EmojiPackageInfo, PlayiconInfo, SkinInfo, SuitLoadingInfo } from "~~/types/api/inner/types";
import { ApiResponse } from "~~/types/api/root";
import { FetchHeaders } from "~~/types/global";

export default defineEventHandler(async (event) => {
    try {
        const query = getQuery(event)
        const idsQuery = query?.ids;
        if (!(typeof idsQuery === "string" || Array.isArray(idsQuery))) {
            setResponseStatus(event, 400);
            return new ApiResponse<null>(-1, "Invalid ids parameter")
        }
        const ids: string[] = Array.isArray(idsQuery) ? idsQuery : [idsQuery];
        // precheck ids is number array
        for (const id of ids) {
            if (isNaN(Number(id))) {
                setResponseStatus(event, 400);
                return new ApiResponse<null>(-1, "Invalid ids parameter")
            }
        }
        const results: SuitComponentResult[] = [];
        for (const id of ids) {
            const result: SuitComponentResult = {
                target: Number(id),
            };
            const APIEndpoint = `https://api.bilibili.com/x/garb/v2/user/suit/benefit?item_id=${id}&part=emoji_package`
            const response = await fetch(APIEndpoint, { method: "GET", headers: FetchHeaders });
            if (response.status !== 200) {
                continue;
            }
            const data = await response.json() as ApiResponse<{
                name: string;
                item_id: number;
                part_id: number;
                properties: never;
                suit_items: {
                    card: never[];
                    card_bg: never[];
                    emoji_package: never[];
                    loading: never[];
                    pendant: never[];
                    play_icon: never[];
                    skin: never[];
                    thumbup: never[];
                    space_bg: never[];
                    emoji: BiliEmojiPackageInfo[];
                }
            }>;
            if (data.code !== 0) {
                continue;
            }
            if (!data.data) {
                continue;
            }
            switch (data.data.part_id) {
                case PartIdType.COLLECTION_THEME_PART: {
                    const properties = data.data.properties as SkinProperties
                    result.skins = [];
                    result.skins.push(parseSkin(data.data.item_id, data.data.name, properties));
                    break;
                }
                case PartIdType.LOADING: {
                    const properties = data.data.properties as LoadingProperties;
                    result.loadings = [];
                    result.loadings.push(parseLoading(data.data.item_id, data.data.name, properties));
                    break;
                }
                case PartIdType.THUMB_UP: {
                    const properties = data.data.properties as ThumbupProperties
                    result.thumbUps = [];
                    result.thumbUps.push(parseThumbUp(data.data.item_id, data.data.name, properties));
                    break;
                }
                case PartIdType.PROGRESS_BAR: {
                    const properties = data.data.properties as ProgressbarProperties
                    result.playIcons = [];
                    result.playIcons.push(parseProgressBarIcon(data.data.item_id, data.data.name, properties)!);
                    break;
                }
                case PartIdType.THEME: {
                    // Emoji Package
                    if (data.data.suit_items.emoji_package) {
                        result.emojis = [];
                        for (const emojiData of data.data.suit_items.emoji_package) {
                            const d = emojiData as { item_id: number; name: string; items: BiliEmojiPackageInfo[] };
                            result.emojis.push(parseEmojiPackage(d.item_id, d.name, d.items));
                        }
                    }

                    // Loading
                    if (data.data.suit_items.loading) {
                        result.loadings = [];
                        for (const loadingData of data.data.suit_items.loading) {
                            const d = loadingData as { item_id: number; name: string; properties: LoadingProperties };
                            result.loadings.push(parseLoading(d.item_id, d.name, d.properties));
                        }
                    }

                    // PlayIcon
                    if (data.data.suit_items.play_icon) {
                        result.playIcons = [];
                        for (const playiconData of data.data.suit_items.play_icon) {
                            const d = playiconData as { item_id: number; name: string; properties: ProgressbarProperties };
                            result.playIcons.push(parseProgressBarIcon(d.item_id, d.name, d.properties)!);
                        }
                    }

                    // Skin
                    if (data.data.suit_items.skin) {
                        result.skins = [];
                        for (const skinData of data.data.suit_items.skin) {
                            const d = skinData as { item_id: number; name: string; properties: SkinProperties };
                            result.skins.push(parseSkin(d.item_id, d.name, d.properties));
                        }
                    }
                    // ThumbUp
                    if (data.data.suit_items.thumbup) {
                        result.thumbUps = [];
                        for (const thumbupData of data.data.suit_items.thumbup) {
                            const d = thumbupData as { item_id: number; name: string; properties: ThumbupProperties };
                            result.thumbUps.push(parseThumbUp(d.item_id, d.name, d.properties));
                        }
                    }
                    // Space Background
                    if (data.data.suit_items.space_bg) {
                        result.spaceBackgrounds = [];
                        for (const spacebgData of data.data.suit_items.space_bg) {
                            const d = spacebgData as { item_id: number; name: string; properties: never };
                            result.spaceBackgrounds.push(parseSpaceBackground(d.item_id, d.name, d.properties));
                        }
                    }
                    break;
                }
                case PartIdType.STATIC_EMOJI_PACKAGE:
                case PartIdType.ANIMATED_EMOJI_PACKAGE: {
                    if (!data.data.suit_items.emoji) {
                        break;
                    }
                    result.emojis = [];
                    result.emojis.push(parseEmojiPackage(data.data.item_id, data.data.name, data.data.suit_items.emoji))
                    break;
                }
            }
            results.push(result);
        }
        setResponseStatus(event, 200);
        return new ApiResponse<SuitComponentResult[]>(0, undefined, results);
    } catch (e) {
        const { isDev } = useRuntimeConfig();
        if (isDev && e instanceof Error) {
            setHeaders(event, { 'X-Error-Detail': e.message });
        }
        setResponseStatus(event, 500);
        return new ApiResponse<null>(-1, "An unexpected error occurred")
    }
})

function parseProgressBarIcon(id: number = 0, name: string = "", properties: ProgressbarProperties): PlayiconInfo | undefined {
    if (properties.drag_icon && properties.icon) {
        return new PlayiconInfo({
            isLottie: true,
            name: name,
            id: id,
            icon: new PlayiconInfo.LottieIcon({
                drag: properties.drag_icon,
                normal: properties.icon,
            })
        });
    } else if (properties.drag_left_png && properties.drag_right_png && properties.icon) {
        return new PlayiconInfo({
            isLottie: false,
            name: name,
            id: id,
            icon: new PlayiconInfo.StaticIcon({
                dragLeft: properties.drag_left_png,
                dragRight: properties.drag_right_png,
                normal: properties.icon,
            })
        });
    }
    return undefined;
}

function parseSkin(id: number = 0, name: string = "", properties: SkinProperties): SkinInfo {
    return new SkinInfo({
        name: name,
        id: id,
        elements: new SkinInfo.SkinElement(properties),
    })
}

function parseLoading(id: number = 0, name: string = "", properties: LoadingProperties): SuitLoadingInfo {
    return new SuitLoadingInfo({
        name: name,
        id: id,
        frame: properties.loading_frame_url,
        animation: properties.loading_url,
        preview: properties.image_preview_small,
    })
}

function parseThumbUp(id: number = 0, name: string = "", properties: ThumbupProperties): { name: string, id: number, ani: string, preview: string } {
    return {
        name: name,
        id: id,
        ani: properties.image_ani,
        preview: properties.image_preview,
    }
}

function parseEmojiPackage(id: number = 0, name: string = "", items: BiliEmojiPackageInfo[]): EmojiPackageInfo {
    return new EmojiPackageInfo({
        name: name,
        item_id: id,
        emojis: items.map(items => ({
            item_id: items.itemId,
            name: items.name,
            images: {
                static: items.properties.image,
                gif: items.properties.image_gif,
                webp: items.properties.image_webp,
            }
        }))
    })
}

function parseSpaceBackground(id: number = 0, name: string = "", properties: never): SkinBackgroundInfo {
    const result: Array<{
        portrait: string;
        landscape: string;
    }> = []
    for (let i = 1; Object.prototype.hasOwnProperty.call(properties, `image${i}_portrait`); i++) {
        result.push({
            portrait: properties[`image${i}_portrait`],
            landscape: properties[`image${i}_landscape`],
        })
    }
    return new SkinBackgroundInfo({
        name: name,
        id: id,
        urls: result,
    })
}