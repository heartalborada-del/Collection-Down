export interface LotteryListItem {
    lottery_id: number;
    lottery_name: string;
}

export interface BiliCardInfo {
    card_img: string;
    card_name: string;
    card_type: number
    video_list: string[];
    card_type_id: number;
    width: number;
    height: number;
}

export interface BiliRedeemInfo {
    redeem_item_type: number;
    redeem_item_name: string;
    redeem_item_id: string | undefined;
    redeem_item_image: string;
}

export interface BiliEmojiPackageInfo {
    itemId: number;
    name: string;
    partId: number;
    properties: {
        image: string;
        image_gif?: string;
        image_webp?: string;
    }
}

export interface BiliSuitMallSearchItem {
    item_id: number;
    part_id: number;
    name: string;
    properties: {
        fan_item_ids?: string;
        dlc_act_id?: string;
        dlc_lottery_id?: string;
        type: string
    }
}