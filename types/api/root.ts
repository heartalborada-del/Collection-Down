export class ApiResponse<T> {
    code: number;
    msg?: string;
    data?: T;

    constructor(code: number = 0, msg?: string, data?: T) {
        this.code = code;
        this.msg = msg;
        this.data = data;
    }
}

export type LotteryListItem = {
    lottery_id: number;
    lottery_name: string;
}

export type CardInfo = {
    card_img: string;
    card_name: string;
    video_list: string[];
}

export type RedeemInfo = {
    redeem_item_type: number;
    redeem_item_name: string;
    redeem_item_ids: string[] | undefined;
    redeem_item_id: string | undefined;
    redeem_item_image: string;
}