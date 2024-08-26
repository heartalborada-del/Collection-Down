export interface DataElement {
    name: string,
    url: string | AnimateEmojiUrl,
    videoUrl?: string,
}

export interface AnimateEmojiUrl {
    static: string,
    gif: string,
    webp: string,

    [key: string]: string;
}
export interface DataPromiseResult {
    name: string,
    data: Map<string,DataElement[]>
}

function generateEmojiList(data: any) {
    let result: DataElement[] = []
    let emojiList = data['suit_items']['emoji_package']
    if (!emojiList) return []
    for (const pack of emojiList) {
        for (const item of pack['items']) {
            result.push({
                name: item['name'],
                url: item['properties']['image'],
            })
        }
    }
    return result
}

function generateSpaceBackgroundList(data: any) {
    let result: DataElement[] = []
    let bgList = data['suit_items']['space_bg']
    if (!bgList) return []
    for (const pack of bgList) {
        for (let i = 1; pack['properties'].hasOwnProperty(`image${i}_portrait`); i++) {
            result.push({
                name: `${pack['name']}-background-${i}`,
                url: pack['properties'][`image${i}_portrait`],
            })
        }
    }
    return result
}

function generateSkinList(data: any) {
    const translation = new Map<string,string>([
        ['image_cover', '封面'],
        ['tail_icon_channel', '动态[未点击]'],
        ['tail_icon_dynamic', '发布动态[未点击]'],
        ['tail_icon_main', '首页[未点击]'],
        ['tail_icon_myself', '我的[未点击]'],
        ['tail_icon_shop', '会员购[未点击]'],
        ['tail_icon_selected_channel', '动态[已点击]'],
        ['tail_icon_selected_dynamic', '发布动态[已点击]'],
        ['tail_icon_selected_main', '首页[已点击]'],
        ['tail_icon_selected_myself', '我的[已点击]'],
        ['tail_icon_selected_shop', '会员购[已点击]'],
        ['head_bg', '上方工具栏'],
        ['tail_bg', '下方导航栏'],
        ['head_myself_squared_bg', '个人空间头图']
    ])
    let result: DataElement[] = []
    let skinList = data['suit_items']['skin']
    if (!skinList) {
        for (const [key,v] of translation) {
            if(!data['properties'].hasOwnProperty(key)) continue;
            result.push({
                name: v,
                url: data['properties'][key],
            })
        }
    } else {
        for (const pack of skinList) {
            for (const [key, v] of translation) {
                if (!pack['properties'].hasOwnProperty(key)) continue;
                result.push({
                    name: v,
                    url: pack['properties'][key],
                })
            }
        }
    }
    return result
}

function generateCardList(data: any) {
    let result: DataElement[] = []
    let items = data['item_list']
    let infos = data['collect_list']['collect_infos']
    let chain = data['collect_list']['collect_chain']
    for (const item of items) {
        if(item['item_type'] !== 1) continue
        result.push({
            name: item['card_info']['card_name'],
            url: item['card_info']['card_img'],
            videoUrl: item['card_info']['video_list'] ? item['card_info']['video_list'][0] : null
        })
    }
    if (infos)
        for (const info of infos) {
            if(info['redeem_item_type'] !== 1) continue
            result.push({
                name: info['card_item']['card_type_info']['name'],
                url: info['card_item']['card_type_info']['overview_image'],
                videoUrl: info['card_item']['card_type_info']['animation'] ? info['card_item']['card_type_info']['animation']['animation_url'] : null
            })
        }
    if (chain)
        for (const ele of chain) {
            if(ele['redeem_item_type'] !== 1) continue
            result.push({
                name: ele['card_item']['card_type_info']['name'],
                url: ele['card_item']['card_type_info']['overview_image'],
                videoUrl: ele['card_item']['card_type_info']['animation'] ? ele['card_item']['card_type_info']['animation']['animation_url'] : null
            })
        }
    return result
}

async function generateCollectList(data: any, APIPrefix = '/bili/ts/') {
    const allowedValues = new Set<number>([
        1000, // 空间背景
        2, // 表情包
        15, //动态表情包
    ]);
    let infos = data['collect_list']['collect_infos'] ? data['collect_list']['collect_infos'] : []
    let chain = data['collect_list']['collect_chain'] ? data['collect_list']['collect_chain'] : []
    const unparsed = [...infos, ...chain];
    let o = await Promise.all(
        Object.entries(unparsed)
            .map((k: any) => new Promise<Map<string, DataElement[]>>(async (resolve) => {
        let data = k[1]
        let type = data['redeem_item_type']
        if (allowedValues.has(type)) {
            switch (type) {
                case 1000:
                    resolve(new Map([
                        ["{OTHER}",[{name: data['redeem_item_name'], url: data['redeem_item_image']}]]
                    ]))
                    return
                case 2:
                case 15: {
                    let o = await fetch(`${APIPrefix}/api/garb/v2/user/suit/benefit?item_id=${data['redeem_item_id']}&part=emoji_package`).then(resp => resp.json())
                    let result: DataElement[] = []
                    let emojis = o['data']['suit_items']['emoji']
                    for (const item of emojis) {
                        if(item['properties']['image_gif']) {
                            result.push({
                                name: item['name'],
                                url: {
                                    static: item['properties']['image'],
                                    gif: item['properties']['image_gif'],
                                    webp: item['properties']['image_webp'],
                                }
                            })
                        } else {
                            result.push({
                                name: item['name'],
                                url: item['properties']['image'],
                            })
                        }
                    }
                    resolve(new Map([
                        [`${o['data']['name']}{STICKER}`, result]
                    ]))
                    return
                }
            }
        }
        resolve(new Map())
    }))
    )
    let result = new Map<string,DataElement[]>();
    o.forEach(map => {
        map.forEach((value, key) => {
            if (result.has(key)) {
                result.get(key)?.push(...value);
            } else {
                result.set(key, value);
            }
        });
    });
    return result
}

export {
    generateEmojiList,
    generateSpaceBackgroundList,
    generateSkinList,
    generateCardList,
    generateCollectList
}