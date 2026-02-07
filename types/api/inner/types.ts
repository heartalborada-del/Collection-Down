import { id } from "@nuxt/ui/runtime/locale/index.js";
import type { ItemType, PackageType } from "../enum";

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
    item_id: number;
    name: string;
    images: {
        "static": string;
        gif?: string;
        webp?: string;
    };

    constructor(data: { item_id: number; name: string; images: { "static": string; gif?: string; webp?: string } }) {
        this.item_id = data.item_id;
        this.name = data.name;
        this.images = data.images;
    }
}

export class EmojiPackageInfo {
    name: string;
    item_id: number;
    emojis: EmojiInfo[];

    constructor(data: { name: string; item_id: number; emojis: EmojiInfo[] | Array<{ item_id: number; name: string; images: { "static": string; gif?: string; webp?: string } }> }) {
        this.name = data.name;
        this.item_id = data.item_id;
        this.emojis = data.emojis.map(e => e instanceof EmojiInfo ? e : new EmojiInfo(e));
    }
}

export class SearchInfo {
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
    id?: number;

    constructor(data: { name: string; img: string; id?: number }) {
        this.name = data.name;
        this.img = data.img;
        this.id = data.id;
    }
}

export class ThumbupInfo {
    name: string;
    preview: string;
    url: string;

    constructor(data: { name: string; preview: string; url: string }) {
        this.name = data.name;
        this.preview = data.preview;
        this.url = data.url;
    }
}

export class LoadingInfo {
    name: string;
    preview: string;
    animated: string;

    constructor(data: { name: string; preview: string; animated: string }) {
        this.name = data.name;
        this.preview = data.preview;
        this.animated = data.animated;
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

export class DownloadMetaData {
    name: string;
    type: ItemType;
    url: string;
    filename: string;

    constructor(data: { name: string; type: ItemType; url: string; filename: string }) {
        this.name = data.name;
        this.type = data.type;
        this.url = data.url;
        this.filename = data.filename;
    }
}

export type PackageDataType = CardInfo | EmojiInfo | OtherInfo | ThumbupInfo | LoadingInfo;

export type CollectionCSVData = {
    '100-300': string;
    '100000+': string;
};

export type CSVDefinition = {
    act_id: string;
    act_title: string;
    status: string;
};

export type SuitComponentResult = {
    target: number;
    emojis?: EmojiPackageInfo[];
    loadings?: SuitLoadingInfo[];
    playIcons?: PlayiconInfo[];
    skins?: SkinInfo[];
    spaceBackgrounds?: SkinBackgroundInfo[];
    thumbUps?: { name: string, id: number, ani: string, preview: string }[];
};

export class SuitLoadingInfo {
    name: string;
    id: number;
    frame: string;
    animation: string;
    preview: string;

    constructor(data: { name: string; id: number; frame: string; animation: string; preview: string }) {
        this.name = data.name;
        this.id = data.id;
        this.frame = data.frame;
        this.animation = data.animation;
        this.preview = data.preview;
    }
}

export class PlayiconInfo {
    name: string;
    id: number;
    isLottie: boolean;
    icon: PlayiconInfo.LottieIcon | PlayiconInfo.StaticIcon;
    constructor(data: { isLottie: boolean; icon: PlayiconInfo.LottieIcon | PlayiconInfo.StaticIcon, name: string; id: number }) {
        this.isLottie = data.isLottie;
        this.icon = data.icon;
        this.name = data.name;
        this.id = data.id;
    }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace PlayiconInfo {
    export class LottieIcon {
        drag: string
        normal: string
        constructor(data: { drag: string; normal: string }) {
            this.drag = data.drag;
            this.normal = data.normal;
        }
    }
    export class StaticIcon {
        dragLeft: string
        dragRight: string
        normal: string
        constructor(data: { dragLeft: string; dragRight: string; normal: string }) {
            this.dragLeft = data.dragLeft;
            this.dragRight = data.dragRight;
            this.normal = data.normal;
        }
    }
}

export class SkinInfo {
    name: string;
    id: number;
    elements: SkinInfo.SkinElement;
    constructor(data: { name: string; id: number; elements: SkinInfo.SkinElement }) {
        this.name = data.name;
        this.id = data.id;
        this.elements = data.elements;
    }

}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace SkinInfo {
    export class SkinElement {
        head_bg: string;
        head_myself_bg: string;
        head_myself_squared_bg: string;
        head_tab_bg: string;
        image_cover: string;
        image_preview: string;
        package_url: string;
        side_bg: string;
        side_bg_bottom: string;
        tail_bg: string;
        tail_icon_channel: string;
        tail_icon_dynamic: string;
        tail_icon_main: string;
        tail_icon_myself: string;
        tail_icon_selected_channel: string;
        tail_icon_selected_dynamic: string
        tail_icon_selected_main: string;
        tail_icon_selected_myself: string
        tail_icon_selected_shop: string;
        tail_icon_shop: string;
        constructor(data: {
            head_bg: string;
            head_myself_bg: string;
            head_myself_squared_bg: string;
            head_tab_bg: string;
            image_cover: string;
            image_preview: string;
            package_url: string;
            side_bg: string;
            side_bg_bottom: string;
            tail_bg: string;
            tail_icon_channel: string;
            tail_icon_dynamic: string;
            tail_icon_main: string;
            tail_icon_myself: string;
            tail_icon_selected_channel: string;
            tail_icon_selected_dynamic: string;
            tail_icon_selected_main: string;
            tail_icon_selected_myself: string;
            tail_icon_selected_shop: string;
            tail_icon_shop: string;
        }) {
            this.head_bg = data.head_bg;
            this.head_myself_bg = data.head_myself_bg;
            this.head_myself_squared_bg = data.head_myself_squared_bg;
            this.head_tab_bg = data.head_tab_bg;
            this.image_cover = data.image_cover;
            this.image_preview = data.image_preview;
            this.package_url = data.package_url;
            this.side_bg = data.side_bg;
            this.side_bg_bottom = data.side_bg_bottom;
            this.tail_bg = data.tail_bg;
            this.tail_icon_channel = data.tail_icon_channel;
            this.tail_icon_dynamic = data.tail_icon_dynamic;
            this.tail_icon_main = data.tail_icon_main;
            this.tail_icon_myself = data.tail_icon_myself;
            this.tail_icon_selected_channel = data.tail_icon_selected_channel;
            this.tail_icon_selected_dynamic = data.tail_icon_selected_dynamic;
            this.tail_icon_selected_main = data.tail_icon_selected_main;
            this.tail_icon_selected_myself = data.tail_icon_selected_myself;
            this.tail_icon_selected_shop = data.tail_icon_selected_shop;
            this.tail_icon_shop = data.tail_icon_shop;
        }
    }
}

export class SkinBackgroundInfo {
    name: string;
    id: number
    urls: {
        portrait: string;
        landscape: string;
    }[]
    constructor(data: { name: string; id: number; urls: { portrait: string; landscape: string }[] }) {
        this.name = data.name;
        this.id = data.id;
        this.urls = data.urls;
    }
}