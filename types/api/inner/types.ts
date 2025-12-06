import type { PackageType } from "../enum";

export class VideoResolution {
    width: number;
    height: number;

    constructor(data: { width: number; height: number }) {
        this.width = data.width;
        this.height = data.height;
    }
}

export class CardInfo {
    type: number;
    id: number;
    name: string;
    img?: string;
    video?: string[];
    resolution: VideoResolution;

    constructor(data: {
        type: number;
        id: number;
        name: string;
        img?: string;
        video?: string[];
        resolution: VideoResolution | { width: number; height: number };
    }) {
        this.type = data.type;
        this.id = data.id;
        this.name = data.name;
        this.img = data.img;
        this.video = data.video;
        this.resolution = data.resolution instanceof VideoResolution
            ? data.resolution
            : new VideoResolution(data.resolution);
    }
}

export class RedeemInfo {
    type: number;
    name: string;
    image: string;
    shared?: boolean;
    ids: string[];

    constructor(data: { type: number; name: string; image: string; shared?: boolean; ids: string[] }) {
        this.type = data.type;
        this.name = data.name;
        this.image = data.image;
        this.shared = data.shared;
        this.ids = data.ids;
    }
}

export class EmojiInfo {
    itemId: number;
    name: string;
    images: {
        "static": string;
        gif?: string;
        webp?: string;
    };

    constructor(data: { itemId: number; name: string; images: { "static": string; gif?: string; webp?: string } }) {
        this.itemId = data.itemId;
        this.name = data.name;
        this.images = data.images;
    }
}

export class EmojiPackageInfo {
    name: string;
    item_id: number;
    emojis: EmojiInfo[];

    constructor(data: { name: string; item_id: number; emojis: EmojiInfo[] | Array<{ itemId: number; name: string; images: { "static": string; gif?: string; webp?: string } }> }) {
        this.name = data.name;
        this.item_id = data.item_id;
        this.emojis = data.emojis.map(e => e instanceof EmojiInfo ? e : new EmojiInfo(e));
    }
}

export class SuitSearchInfo {
    name: string;
    cover: string;
    type: number;
    id: number;
    sub_ids: number[];

    constructor(data: { name: string; cover: string; type: number; id: number; sub_ids: number[] }) {
        this.name = data.name;
        this.cover = data.cover;
        this.type = data.type;
        this.id = data.id;
        this.sub_ids = data.sub_ids;
    }
}

export class OtherInfo {
    name: string;
    img: string;
    id: number;

    constructor(data: { name: string; img: string; id: number }) {
        this.name = data.name;
        this.img = data.img;
        this.id = data.id;
    }
}

export class DetailedData {
    id: number;
    name?: string;
    type: PackageType;
    data: PackageDataType[];

    constructor(data: { id: number; name?: string; type: PackageType; data: PackageDataType[] }) {
        this.id = data.id;
        this.name = data.name;
        this.type = data.type;
        this.data = data.data;
    }
}

export type PackageDataType = CardInfo | EmojiInfo | OtherInfo;