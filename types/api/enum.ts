/* eslint-disable @typescript-eslint/prefer-literal-enum-member */
export enum RedeemType {
    BADGE = 1001,
    AVATAR_FRAME = 3,
    STATIC_EMOJI_PACKAGE = 2,
    ANIMATED_EMOJI_PACKAGE = 15,
    SUIT_PART = 5,
    COLLECTION_CARD = 1
}

export enum PartIdType {
    STATIC_EMOJI_PACKAGE = 7,
    ANIMATED_EMOJI_PACKAGE = 5,
    PROGRESS_BAR = 11,
    LOADING = 10,
    THUMB_UP = 3,
    COLLECTION_THEME_PART = 9,
    //SEARCH
    COLLECTION = 0,
    THEME = 6
}

export enum PackageType {
    Undefined = 0,
    Card = 1,
    Sticker = 2,
    Theme = 3,
    Other = 4
}

export enum ItemType {
    // group bits: 0x100 = Card, 0x200 = Sticker, 0x300 = Other
    StaticCard = 0x100 | 1,
    StaticCardWatermarked = 0x100 | 2,
    AnimatedCard = 0x100 | 3,
    AnimatedCardWatermarked = 0x100 | 4,

    WebpSticker = 0x200 | 1,
    GifSticker = 0x200 | 2,
    StaticSticker = 0x200 | 3,

    Other = 0x300 | 1,
    SVGA = 0x300 | 2,

    PlayIconLottie = 0x400 | 1,
    PlayIconStatic = 0x400 | 2,
    PlayIconPreview = 0x400 | 3
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ItemType {
    export const GROUP_MASK = 0xF00;
    export function isCard(t: ItemType) { return (t & GROUP_MASK) === 0x100; }
    export function isSticker(t: ItemType) { return (t & GROUP_MASK) === 0x200; }
    export function toString(t: ItemType): string {
        switch (t) {
            case ItemType.StaticCard: return "Static Card";
            case ItemType.StaticCardWatermarked: return "Static Card (Watermarked)";
            case ItemType.AnimatedCard: return "Animated Card";
            case ItemType.AnimatedCardWatermarked: return "Animated Card (Watermarked)";
            case ItemType.WebpSticker: return "WebP Sticker";
            case ItemType.GifSticker: return "GIF Sticker";
            case ItemType.StaticSticker: return "Static Sticker";
            case ItemType.Other: return "Other";
            case ItemType.SVGA: return "SVGA";
            case ItemType.PlayIconLottie: return "Play Icon (Lottie)";
            case ItemType.PlayIconStatic: return "Play Icon (Static)";
            case ItemType.PlayIconPreview: return "Play Icon (Preview)";
            default: return "Unknown";
        }
    }
}