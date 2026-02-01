import type { LotteryListItem } from "~~/types/api/bili/types";
import { PackageType, RedeemType } from "~~/types/api/enum";
import { CardInfo, EmojiInfo, EmojiPackageInfo, LoadingInfo, OtherInfo, ThumbupInfo, type DetailedData, type PackageDataType, type RedeemInfo, type SuitComponentResult } from "~~/types/api/inner/types";
import type { ApiResponse } from "~~/types/api/root";

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
    let flag = true;
    const promises = data.data.map(async item => {
        const res = GetLotteryDetails(item.lottery_id, actId, item.lottery_name, flag)
        flag = false;
        return res;
    })

    const merged = await Promise.allSettled(promises)

    merged.forEach(item => {
        console.log(item);
        if (item.status === 'rejected') {
            console.warn(`Failed to fetch lottery details`);
            console.warn(item.reason);
        }
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
    //console.log(ItemsArray);
    return ItemsArray
}

async function GetLotteryDetails(lotteryId: number, actId: number, lotteryName: string, allowShared: boolean = false): Promise<DetailedData[]> {
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
    const migratedRedeems: DetailedData[] = []
    const otherRedeems: DetailedData = {
        id: lotteryId,
        name: lotteryName,
        data: [] as OtherInfo[],
        type: PackageType.Other
    }
    for (const redeem of parsedRedeems) {
        if (redeem.type === PackageType.Other) {
            redeem.data.forEach(item => {
                (otherRedeems.data as OtherInfo[]).push(
                    new OtherInfo({
                        name: redeem.name ?? '',
                        img: (item as OtherInfo).img,
                        id: lotteryId
                    })
                );
            })
        } else {
            migratedRedeems.push(redeem)
        }
    }
    const cardObjects: CardInfo[] = [];
    (res.data?.items).forEach((card: CardInfo) => {
        cardObjects.push(new CardInfo(card))
    })
    const returnValue: DetailedData[] = [{
        id: lotteryId,
        name: lotteryName,
        data: cardObjects,
        type: PackageType.Card
    } as DetailedData,
    ...migratedRedeems
    ]
    if (otherRedeems.data.length !== 0) {
        returnValue.push(otherRedeems)
    }
    if (allowShared) {
        const sharedRedeems = await ParseRedeemOnlyShared(res.data.redeems)
        returnValue.push(...sharedRedeems)
    }
    return returnValue
}

async function ParseRedeemInfo(redeems: RedeemInfo[], lotteryId: number, onlyShared: boolean = false): Promise<DetailedData[]> {
    const results: DetailedData[] = []
    for (const redeem of redeems) {
        if (redeem.shared && !onlyShared)
            continue;
        if (onlyShared && !redeem.shared)
            continue;
        switch (redeem.type) {
            case RedeemType.AVATAR_FRAME:
            case RedeemType.BADGE:
                let id = function () {
                    if (redeem.ids && redeem.ids.length > 0 && redeem.ids[0]) {
                        return parseInt(redeem.ids[0], 10)
                    }
                    return -1;
                }();
                results.push({
                    id: id,
                    name: redeem.name,
                    type: PackageType.Other,
                    data: [new OtherInfo({
                        name: redeem.name,
                        img: redeem.image,
                        id: id
                    })
                    ]
                } as DetailedData)
                break;
            case RedeemType.ANIMATED_EMOJI_PACKAGE:
            case RedeemType.STATIC_EMOJI_PACKAGE: {
                const data = await fetch(`/api/bili/suit/emojiPackageList?package_id=${redeem.ids[0]}`)
                if (!data.ok) {
                    break;
                }
                const res = (await data.json()) as ApiResponse<EmojiPackageInfo>
                if (res.code !== 0 || !res.data) {
                    break;
                }
                results.push({
                    id: redeem.ids[0] ? parseInt(redeem.ids[0], 10) : -1,
                    name: res.data.name,
                    type: PackageType.Sticker,
                    data: (res.data.emojis.map(emoji => { return new EmojiInfo(emoji) }))
                } as DetailedData)
                break
            }

            case RedeemType.SUIT_PART: {
                const suitDetails = await GetSuitMigratedData(redeem.ids.map(id => parseInt(id, 10)))
                results.push(...suitDetails)
                break;
                /*suitDetails.forEach((value)=>{
                    value.data = value.data.filter((dataItem)=>{
                        if(dataItem instanceof EmojiPackageInfo)
                            return false;
                        return true;
                    })
                    results.push(value);
                })
                    */
            }
        }
    }
    return results
}

async function ParseRedeemOnlyShared(redeems: RedeemInfo[]): Promise<DetailedData[]> {
    return ParseRedeemInfo(redeems, -1, true)
}

async function GetSuitMigratedData(partIds: number[]) {
    const returnValue: DetailedData[] = [];
    if (partIds.length === 0) {
        return returnValue;
    }
    const idsParam = partIds.map(id => `ids=${id}`).join('&');
    const resp = await fetch(`/api/bili/suit/suitComponents?${idsParam}`);
    if (!resp.ok) {
        return Promise.reject(new PromiseRejected(Errors.NETWORK, `Status Code: ${resp.status}`, resp.status));
    }
    const data = (await resp.json()) as ApiResponse<SuitComponentResult[]>;
    if (data.code !== 0 || !data.data) {
        return Promise.reject(new PromiseRejected(Errors.API, data.message, data.code));
    }
    const themePackage: {
        [key: string]: {
            id: number,
            package: PackageDataType[],
        };
    } = {};
    data.data?.forEach(arr => {
        let id = arr.target
        arr.emojis?.forEach(element => {
            returnValue.push({
                id: element.item_id,
                name: element.name,
                type: PackageType.Sticker,
                data: element.emojis.map(emoji => {
                    return new EmojiInfo(emoji);
                })
            });
        });
        arr.skins?.forEach(element => {
            let OtherInfoArray: OtherInfo[] = [];
            (Object.keys(element.elements) as Array<keyof typeof element.elements>).forEach(key => {
                if (key === 'package_url') return;
                const val = element.elements[key];
                if (typeof val === 'string' && val.length > 0) {
                    OtherInfoArray.push(new OtherInfo({
                        name: String(key),
                        img: val,
                    }));
                }
            });
            if (themePackage[element.name] === undefined) {
                themePackage[element.name] = {
                    id: id,
                    package: [],
                };
            }
            themePackage[element.name]?.package.push(...OtherInfoArray);
        });
        arr.thumbUps?.forEach(element => {
            if (themePackage[element.name] === undefined) {
                themePackage[element.name] = {
                    id: id,
                    package: [],
                };
            }
            themePackage[element.name]?.package.push(new ThumbupInfo({
                name: "thumbup",
                preview: element.preview,
                url: element.ani,
            }));
        })
        arr.loadings?.forEach(element => {
            if (themePackage[element.name] === undefined) {
                themePackage[element.name] = {
                    id: id,
                    package: [],
                };
            }
            themePackage[element.name]?.package.push(new LoadingInfo({
                name: "loading",
                preview: element.preview,
                animated: element.animation,
            }));
        })
        arr.spaceBackgrounds?.forEach(element => {
            if (themePackage[element.name] === undefined) {
                themePackage[element.name] = {
                    id: id,
                    package: [],
                };
            }
            let i = 1;
            element.urls.forEach((url) => {
                themePackage[element.name]?.package.push(new OtherInfo({
                    name: `background_landscape_${i}`,
                    img: url.landscape,
                }));
                themePackage[element.name]?.package.push(new OtherInfo({
                    name: `background_portrait_${i}`,
                    img: url.portrait,
                }));
                i++;
            });
        });
    })
    for (const key in themePackage) {
        if (themePackage[key] === undefined || themePackage[key].package.length === 0) continue;
        returnValue.push({
            id: themePackage[key].id,
            name: key,
            type: PackageType.Theme,
            data: themePackage[key].package,
        });
    }
    return returnValue;
}

export async function GetSuitDetails(partId: number) {
    return GetSuitMigratedData([partId]);
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

