import type { PackageType } from "../enum";

export interface CardInfo {
    type: number;
    id: number
    name: string;
    img?: string;
    video?: string[];
    resolution: VideoResolution;
}

export interface VideoResolution {
    width: number;
    height: number;
}

export interface RedeemInfo {
    type: number;
    name: string;
    image: string;
    shared?: boolean;
    ids: string[];
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

export interface OtherInfo {
    name: string;
    img: string;
    id: number;
}
export interface DetailedData {
    id: number
    name: string,
    type: PackageType,
    data: CardInfo[] | EmojiInfo[] | OtherInfo[] | string[],
}