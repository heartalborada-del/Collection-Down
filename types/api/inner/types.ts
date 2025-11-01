export interface CardInfo {
    type: number;
    id: number
    name: string;
    img: string;
    video: string[];
    resolution:VideoResolution;
}

export interface VideoResolution {
    width: number;
    height: number;
}

export interface RedeemInfo {
    type: number;
    name: string;
    image: string;
    ids?: string[];
}

export interface EmojiInfo {
    itemId: number;
    name: string;
    images: {
        "static": string;
        gif?: string;
        webp?: string;
    }
}
export interface EmojiPackageInfo {
    name: string;
    item_id: number;
    emojis: EmojiInfo[];
}

export interface SuitSearchInfo {
    name: string;
    cover: string;
    type: number;
    id: number;
    sub_ids: number[];
}