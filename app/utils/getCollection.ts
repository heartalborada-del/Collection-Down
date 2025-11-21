import type {ApiResponse} from "~~/types/api/root";
import type {LotteryListItem} from "~~/types/api/bili/types";
import type {CardInfo, DetailedData, EmojiPackageInfo, RedeemInfo, OtherInfo} from "~~/types/api/inner/types";
import {PackageType, RedeemType} from "~~/types/api/enum";

export async function GetCollectionMigratedData(actId: number): Promise<DetailedData[]> {
    const ItemsArray: DetailedData[] = [];
    const resp = await fetch(`/api/bili/collection/allLotteryId?act_id=${actId}`)
    if (!resp.ok) {
        return Promise.reject(new PromiseRejected(Errors.NETWORK, `Status Code: ${resp.status}`, resp.status))
    }
    const data = (await resp.json()) as ApiResponse<LotteryListItem[]>
    if (data.code !== 0 || !data.data) {
        return Promise.reject(new PromiseRejected(Errors.API, data.message, data.code))
    }
    const promises = data.data.map(async item => GetLotteryCardDetails(item.lottery_id, actId, item.lottery_name))

    const merged = await Promise.allSettled(promises)

    merged.forEach(item => {
        if (item.status === 'fulfilled' && item.value)
            item.value.forEach((item: DetailedData) => {
                ItemsArray.push({
                    id: item.id,
                    name: item.name,
                    data: item.data,
                    type: item.type
                })
            })
    })
    return ItemsArray
}

async function GetLotteryCardDetails(lotteryId: number, actId: number, lotteryName: string): Promise<DetailedData[]> {
    const response = await fetch(`/api/bili/collection/collectLootInfo?act_id=${actId}&lottery_id=${lotteryId}`)
    if (!response.ok) {
        return Promise.reject(new PromiseRejected(Errors.NETWORK, `Status Code: ${response.status}`, response.status))
    }
    const res = (await response.json()) as ApiResponse<{
        items: CardInfo[],
        redeems: RedeemInfo[],
    }>
    if (res.code !== 0 || !res.data) {
        return Promise.reject(new PromiseRejected(Errors.API, res.message, res.code))
    }
    const parsedRedeems = await ParseRedeemInfo(res.data.redeems, lotteryId)
    const migratedRedeems:DetailedData[] = []
    const otherRedeems:DetailedData  = {
        id: lotteryId,
        name: lotteryName,
        data: [] as OtherInfo[],
        type: PackageType.Other
    }
    for (const redeem of parsedRedeems) {
        if (redeem.type === PackageType.Other) {
            redeem.data.forEach(item => {
                const url = item as string
                (otherRedeems.data as OtherInfo[]).push({
                    name: redeem.name,
                    img: url,
                    id: lotteryId
                } as OtherInfo)
            })
        } else {
            migratedRedeems.push(redeem)
        }
    }
    if (otherRedeems.data.length === 0) {
        return [{
            id: lotteryId,
            name: lotteryName,
            data: res.data?.items,
            type: PackageType.Card
        } as DetailedData,
            ...migratedRedeems
        ]
    }
    return [{
        id: lotteryId,
        name: lotteryName,
        data: res.data?.items,
        type: PackageType.Card
    } as DetailedData,
        otherRedeems,
        ...migratedRedeems
    ]
}

async function ParseRedeemInfo(redeems: RedeemInfo[], lotteryId: number, allowShared: boolean = false): Promise<DetailedData[]> {
    const results: DetailedData[] = []
    for (const redeem of redeems) {
        if (redeem.shared && !allowShared)
            continue;
        switch (redeem.type) {
            case RedeemType.BADGE, RedeemType.AVATAR_FRAME:
                results.push({
                    id: parseInt(redeem.ids[0] ? redeem.ids[0] : "-1",10),
                    name: redeem.name,
                    type: PackageType.Other,
                    data: [redeem.image]
                } as DetailedData)
                break
            case RedeemType.STATIC_EMOJI_PACKAGE: {
                const data = await fetch(`/api/bili/suit/emojiPackageList?package_id=${redeem.ids[0]}`)
                if (!data.ok) {
                    continue;
                }
                const res = (await data.json()) as ApiResponse<EmojiPackageInfo>
                if (res.code !== 0 || !res.data) {
                    continue;
                }
                results.push({
                    id: lotteryId,
                    name: res.data.name,
                    type: PackageType.Sticker,
                    data: res.data.emojis
                } as DetailedData)
                break
            }
            case RedeemType.SUIT_PART: {
                //TODO implement suit part parsing
                break
            }
        }
    }
    return results
}

export enum Errors {
    NETWORK = "Network Error",
    API = "API Error",
    NO_DATA = "No Data Found"
}

//Promise reject structure:
export class PromiseRejected {
    constructor(public error: Errors, public message?: string, public code?: number) {
    }
}