import type { LotteryListItem } from "~~/types/api/bili/types";
import { PackageType, RedeemType } from "~~/types/api/enum";
import { CardInfo, EmojiInfo, type EmojiPackageInfo, LoadingInfo, OtherInfo, PlayiconInfo, ThumbupInfo, type DetailedData, type PackageDataType, type RedeemInfo, type SuitComponentResult } from "~~/types/api/inner/types";
import type { ApiResponse } from "~~/types/api/root";
import { createApiResponseError, getErrorMessage } from "~/utils/apiError";

export async function GetCollectionMigratedData(actId: number, onWarning?: (message: string) => void): Promise<DetailedData[]> {
    const ItemsArray: DetailedData[] = [];
    const resp = await fetch(`/api/bili/collection/allLotteryId?act_id=${actId}`)
    if (!resp.ok) {
        throw await createApiResponseError(resp, '获取收藏集抽奖列表')
    }
    const data = (await resp.json()) as ApiResponse<LotteryListItem[]>
    if (data.code !== 0 || !data.data) {
        return Promise.reject(new PromiseRejected(Errors.API, data.message, data.code))
    }
    let flag = true;
    const promises = data.data.map(async item => {
        const res = GetLotteryDetails(item.lottery_id, actId, item.lottery_name, flag, onWarning)
        flag = false;
        return res;
    })

    const merged = await Promise.allSettled(promises)

    merged.forEach(item => {
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
    const failures = merged
        .filter((item): item is PromiseRejectedResult => item.status === 'rejected')
        .map(item => getErrorMessage(item.reason))
    if (failures.length > 0) {
        throw new Error(`有 ${failures.length} 个收藏集明细加载失败：${failures.join('；')}`)
    }
    return ItemsArray
}

async function GetLotteryDetails(lotteryId: number, actId: number, lotteryName: string, allowShared: boolean = false, onWarning?: (message: string) => void): Promise<DetailedData[]> {
    const response = await fetch(`/api/bili/collection/collectLootInfo?act_id=${actId}&lottery_id=${lotteryId}`)
    if (!response.ok) {
        throw await createApiResponseError(response, `获取抽奖 ${lotteryId} 明细`)
    }
    const res = (await response.json()) as ApiResponse<{
        items: CardInfo[],
        redeems: RedeemInfo[],
    }>
    if (res.code !== 0 || !res.data) {
        return Promise.reject(new PromiseRejected(Errors.API, res.message, res.code))
    }
    const cardObjects: CardInfo[] = [];
    (res.data.items ?? []).forEach((card: CardInfo) => {
        cardObjects.push(new CardInfo(card))
    })
    // Prefer backend-returned IDs; if redeem IDs are invalid (e.g. 0), fallback to a valid card ID when available.
    const fallbackId = cardObjects.find(card => card.id > 0)?.id ?? lotteryId
    const parsedRedeems = await ParseRedeemInfo(res.data.redeems, fallbackId, false, onWarning)
    const migratedRedeems: DetailedData[] = []
    const otherRedeems: DetailedData = {
        id: fallbackId,
        name: lotteryName,
        data: [] as OtherInfo[],
        type: PackageType.Other
    }
    for (const redeem of parsedRedeems) {
        if (redeem.type === PackageType.Other) {
            redeem.data.forEach(item => {
                const other = item as OtherInfo
                (otherRedeems.data as OtherInfo[]).push(
                    new OtherInfo({
                        name: redeem.name ?? '',
                        img: other.img,
                        id: other.id && other.id > 0 ? other.id : fallbackId
                    })
                );
            })
        } else {
            migratedRedeems.push(redeem)
        }
    }
    const returnValue: DetailedData[] = [{
        id: fallbackId,
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
        const sharedRedeems = await ParseRedeemOnlyShared(res.data.redeems, fallbackId, onWarning)
        returnValue.push(...sharedRedeems)
    }
    return returnValue
}

async function ParseRedeemInfo(redeems: RedeemInfo[], lotteryId: number, onlyShared: boolean = false, onWarning?: (message: string) => void): Promise<DetailedData[]> {
    const results: DetailedData[] = []
    for (const redeem of redeems) {
        if (redeem.shared && !onlyShared)
            continue;
        if (onlyShared && !redeem.shared)
            continue;
        switch (redeem.type) {
            case RedeemType.AVATAR_FRAME:
            case RedeemType.BADGE:
                {
                    const id = function () {
                        if (redeem.ids && redeem.ids.length > 0 && redeem.ids[0]) {
                            const parsed = parseInt(redeem.ids[0], 10)
                            if (Number.isFinite(parsed) && parsed > 0) {
                                return parsed
                            }
                        }
                        return lotteryId;
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
                }
            case RedeemType.ANIMATED_EMOJI_PACKAGE:
            case RedeemType.STATIC_EMOJI_PACKAGE: {
                const data = await fetch(`/api/bili/suit/emojiPackageList?package_id=${redeem.ids[0]}`)
                if (!data.ok) {
                    throw await createApiResponseError(data, `获取表情包 ${redeem.ids[0]}`)
                }
                const res = (await data.json()) as ApiResponse<EmojiPackageInfo>
                if (res.code !== 0 || !res.data) {
                    throw new PromiseRejected(Errors.API, res.message || `表情包 ${redeem.ids[0]} 未返回数据`, res.code)
                }
                const id = redeem.ids && redeem.ids.length > 0 && redeem.ids[0] ? parseInt(redeem.ids[0], 10) : lotteryId
                results.push({
                    id: Number.isFinite(id) && id > 0 ? id : lotteryId,
                    name: res.data.name,
                    type: PackageType.Sticker,
                    data: (res.data.emojis.map(emoji => { return new EmojiInfo(emoji) }))
                } as DetailedData)
                break
            }
            case RedeemType.SUIT_PART: {
                const suitDetails = await GetSuitMigratedData(redeem.ids.map(id => parseInt(id, 10)), onWarning)
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

async function ParseRedeemOnlyShared(redeems: RedeemInfo[], fallbackId: number, onWarning?: (message: string) => void): Promise<DetailedData[]> {
    return ParseRedeemInfo(redeems, fallbackId, true, onWarning)
}

async function GetSuitMigratedData(partIds: number[], onWarning?: (message: string) => void) {
    const returnValue: DetailedData[] = [];
    if (partIds.length === 0) {
        return returnValue;
    }
    const idsParam = partIds.map(id => `ids=${id}`).join('&');
    const resp = await fetch(`/api/bili/suit/suitComponents?${idsParam}`);
    if (!resp.ok) {
        throw await createApiResponseError(resp, '获取主题组件');
    }
    const data = (await resp.json()) as ApiResponse<SuitComponentResult[]>;
    if (data.code !== 0 || !data.data) {
        return Promise.reject(new PromiseRejected(Errors.API, data.message, data.code));
    }
    if (data.message && onWarning) {
        onWarning(data.message)
    }
    const themePackage: {
        [key: string]: {
            id: number,
            package: PackageDataType[],
        };
    } = {};
    data.data?.forEach(arr => {
        const id = arr.target
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
            const OtherInfoArray: OtherInfo[] = [];
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
        arr.playIcons?.forEach(element => {
            if (themePackage[element.name] === undefined) {
                themePackage[element.name] = {
                    id: id,
                    package: [],
                };
            }
            themePackage[element.name]?.package.push(new PlayiconInfo({
                ...element,
                name: "playicon",
            }));
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

export async function GetSuitDetails(partId: number, onWarning?: (message: string) => void) {
    return GetSuitMigratedData([partId], onWarning);
}

export enum Errors {
    NETWORK = "Network Error",
    API = "API Error",
    NO_DATA = "No Data Found"
}

//Promise reject structure:
export class PromiseRejected {
    constructor(public error: Errors, public message?: string, public code?: number) { }
}
