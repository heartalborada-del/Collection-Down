import { ca } from "@nuxt/ui/runtime/locale/index.js";
import { LoadingProperties, ProgressbarProperties, SkinProperties, ThumbupProperties } from "~~/types/api/bili/types";
import { PartIdType } from "~~/types/api/enum";
import { PlayiconInfo, SkinInfo, SuitComponentResults, SuitLoadingInfo } from "~~/types/api/inner/types";
import { ApiResponse } from "~~/types/api/root";
import { FetchHeaders } from "~~/types/global";

export default defineEventHandler(async (event) => {
    try {
        const query = getQuery(event)
        const idsQuery = query?.ids;
        if (!(typeof idsQuery === "string" || Array.isArray(idsQuery))) {
            return new ApiResponse<null>(-1, "Invalid ids parameter")
        }
        const ids: string[] = Array.isArray(idsQuery) ? idsQuery : [idsQuery];
        // precheck ids is number array
        for (const id of ids) {
            if (isNaN(Number(id))) {
                return new ApiResponse<null>(-1, "Invalid ids parameter")
            }
        }
        let results: SuitComponentResults = {
            emojis: [],
            loadings: [],
            avatarFrames: [],
            playIcons: [],
            skins: [],
            spaceBackgrounds: [],
            thumbups: []
        };
        for (const id of ids) {
            const APIEndpoint = `https://api.bilibili.com/x/garb/v2/user/suit/benefit?item_id=${id}&part=emoji_package`
            const response = await fetch(APIEndpoint, { method: "GET", headers: FetchHeaders });
            if (response.status !== 200) {
                return new ApiResponse<null>(-1, `Failed to fetch data, status code: ${response.status}`);
            }
            const data = await response.json() as ApiResponse<{
                name: string;
                item_id: number;
                part_id: number;
                properties: any;
            }>;
            if (data.code !== 0)
                return new ApiResponse<null>(data.code, `Bilibili api error, msg: ${data.message}`);
            if (!data.data)
                return new ApiResponse<null>(-1, `Failed to fetch data`);
            console.log(data.data);
            switch (data.data.part_id) {
                case PartIdType.COLLECTION_THEME_PART: {
                    const properties = data.data.properties as SkinProperties
                    results.skins.push(new SkinInfo({
                        name: data.data.name,
                        id: data.data.item_id,
                        elements: new SkinInfo.SkinElement(properties),
                    }));
                    break;
                }
                case PartIdType.LOADING: {
                    const properties = data.data.properties as LoadingProperties;
                    results.loadings.push(new SuitLoadingInfo({
                        name: data.data.name,
                        id: data.data.item_id,
                        frame: properties.loading_frame_url,
                        animation: properties.loading_url,
                    }));
                    break;
                }
                case PartIdType.THUMB_UP: {
                    const properties = data.data.properties as ThumbupProperties
                    results.thumbups.push({
                        name: data.data.name,
                        id: data.data.item_id,
                        ani: properties.image_ani,
                        preview: properties.image_preview,
                    });
                    break;
                }
                case PartIdType.PROGRESS_BAR: {
                    const properties = data.data.properties as ProgressbarProperties
                    if (properties.drag_icon && properties.icon) {
                        results.playIcons.push(new PlayiconInfo({
                            isLottie: true,
                            name: data.data.name,
                            id: data.data.item_id,
                            icon: new PlayiconInfo.LottieIcon({
                                drag: properties.drag_icon,
                                normal: properties.icon,
                            })
                        }));
                    } else if (properties.drag_left_png && properties.drag_right_png && properties.icon) {
                        results.playIcons.push(new PlayiconInfo({
                            isLottie: false,
                            name: data.data.name,
                            id: data.data.item_id,
                            icon: new PlayiconInfo.StaticIcon({
                                dragLeft: properties.drag_left_png,
                                dragRight: properties.drag_right_png,
                                normal: properties.icon,
                            })
                        }));
                    }
                    break;
                }
                case PartIdType.THEME: {

                }
            }
            return new ApiResponse<SuitComponentResults>(0, undefined, results);
        }
    } catch {
        return new ApiResponse<null>(-1, "An unexpected error occurred")
    }
})