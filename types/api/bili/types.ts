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
    lottery_id: number;
    card_item: never;
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
        type: string,
        image_cover: string,
    }
}

export interface SkinProperties {
    color: string;
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
}

export interface LoadingProperties {
    loading_frame_url: string;
    loading_url: string;
    image_preview_small: string;
}

export interface ThumbupProperties {
    image_ani: string;
    image_preview: string;
}

export interface ProgressbarProperties {
    drag_icon: string
    icon: string
    drag_left_png: string
    drag_right_png: string
    middle_png: string
}
