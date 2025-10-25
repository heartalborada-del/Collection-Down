export interface DataElement {
    name: string,
    url: string | AnimateEmojiUrl | LikeAnimationUrl,
    videoUrl?: string,
}

export interface LikeAnimationUrl {
    static: string,
    bin: string,
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
        ['drag_left_png', "向后拉进度条"],
        ['drag_right_png', "向前拉进度条"],
        ['middle_png', "未拉动进度条"],
        ['loading_url', '加载动画'],
        ['head_myself_bg', '个人主页头图'],
        ['image_ani', '点赞动画']
    ])
    let result: DataElement[] = []
    if (!data['suit_items']) return result
    let skinList = data['suit_items']['skin']
    const processFunction = (key: string, value: string, properties: any, category_name: string = "") => {
        let name = category_name == "" ? value : `${category_name}-${value}`;
        if (key === 'head_myself_bg') {
            return {
                name: name,
                url: properties['head_myself_bg'],
                videoUrl: properties['head_myself_mp4_bg'],
            }
        }
        if (key === 'image_ani') {
            return {
                name: name,
                url: {
                    static: properties['image_preview'],
                    bin: properties['image_ani_cut'],
                } as LikeAnimationUrl,
            }
        }
        return {
            name: name,
            url: properties[key],
        }
    }
    if (!skinList) {
        for (const [key,v] of translation) {
            if(!data['properties'].hasOwnProperty(key)) continue;
            result.push(processFunction(key, v, data['properties'], data['name']))
        }
    } else {
        for (const pack of skinList) {
            for (const [key, v] of translation) {
                if (!pack['properties'].hasOwnProperty(key)) continue;
                result.push(processFunction(key, v, pack['properties'], pack['name']))
            }
        }
        if ("thumbup" in data['suit_items']) {
            const thumbup = data['suit_items']['thumbup']
            for (const item of thumbup) {
                if (item['properties']['image_preview']) {
                    result.push({
                        name: `${item['name']}-点赞动画`,
                        url: {
                            static: item['properties']['image_preview'],
                            bin: item['properties']['image_ani_cut'],
                        } as LikeAnimationUrl,
                    })
                }
            }
        }
        if ("play_icon" in data['suit_items']) {
            const playicon = data['suit_items']['play_icon']
            for (const item of playicon) {
                for (const [key, v] of translation) {
                    if (!item['properties'].hasOwnProperty(key)) continue;
                    result.push(processFunction(key, v, item['properties'], item['name']))
                }
            }
        }
    }
    return result
}

function generateCardList(data: any) {
    let result: DataElement[] = []
    let already = new Set<string>()
    let items = data['item_list']
    let infos = data['collect_list']['collect_infos'] ? data['collect_list']['collect_infos'] : []
    let chain = data['collect_list']['collect_chain'] ? data['collect_list']['collect_chain'] : []
    for (const item of items) {
        let root = item['card_info'] ? item['card_info'] : item['card_item']
        if (item['item_type'] !== 1 || already.has(root['card_name'])) continue
        already.add(root['card_name'])
        result.push({
            name: root['card_name'],
            url: root['card_img'],
            videoUrl: root['video_list'] ? root['video_list'][0] : null
        })
    }
    if (infos)
        for (const info of infos) {
            if (info['redeem_item_type'] !== 1 || info['card_item']['card_type_info']['material_sub_type'] || already.has(info['card_item']['card_type_info']['name'])) continue
            already.add(info['card_item']['card_type_info']['name'])
            result.push({
                name: info['card_item']['card_type_info']['name'],
                url: info['card_item']['card_type_info']['overview_image'],
                videoUrl: info['card_item']['card_type_info']['content']['animation'] ? info['card_item']['card_type_info']['content']['animation']['animation_video_urls'][0] : null
            })
        }
    if (chain)
        for (const ele of chain) {
            if (ele['redeem_item_type'] !== 1 || ele['card_item']['card_type_info']['material_sub_type'] || already.has(ele['card_item']['card_type_info']['material_sub_type'])) continue
            already.add(ele['card_info']['card_type_info']['name'])
            result.push({
                name: ele['card_item']['card_type_info']['name'],
                url: ele['card_item']['card_type_info']['overview_image'],
                videoUrl: ele['card_item']['card_type_info']['content']['animation'] ? ele['card_item']['card_type_info']['content']['animation']['animation_video_urls'][0] : null
            })
        }
    return result
}

async function generateCollectList(data: any, APIPrefix = '/bili/ts/') {
    const allowedValues = new Set<number>([
        1000, // 空间背景
        2, // 表情包
        5, // 主题
        15, //动态表情包
    ]);
    let unparsed: any[]
    if (data['collect_list'] instanceof Array) {
        unparsed = data['collect_list']
    } else {
        let infos = data['collect_list']['collect_infos'] ? data['collect_list']['collect_infos'] : []
        let chain = data['collect_list']['collect_chain'] ? data['collect_list']['collect_chain'] : []
        unparsed = [...infos, ...chain];
    }
    //debugger
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
                    if (o['data']['properties']['item_emoji_list']) {
                        let emojis = JSON.parse(o['data']['properties']['item_emoji_list'])
                        for (const item of emojis) {
                            if(item['image_gif']) {
                                result.push({
                                    name: `[${o["data"]["name"]}-${item['name']}]`,
                                    url: {
                                        static: item['image'],
                                        gif: item['image_gif'],
                                        webp: item['image_webp'],
                                    } as AnimateEmojiUrl,
                                })
                            } else {
                                result.push({
                                    name: `[${o["data"]["name"]}-${item['name']}]`,
                                    url: item['image'],
                                })
                            }
                        }
                    } else{
                        let emojis = o['data']['suit_items']['emoji']
                        for (const item of emojis) {
                            if(item['properties']['image_gif']) {
                                result.push({
                                    name: item['name'],
                                    url: {
                                        static: item['properties']['image'],
                                        gif: item['properties']['image_gif'],
                                        webp: item['properties']['image_webp'],
                                    } as AnimateEmojiUrl,
                                })
                            } else {
                                result.push({
                                    name: item['name'],
                                    url: item['properties']['image'],
                                })
                            }
                        }
                    }
                    resolve(new Map([
                        [`${o['data']['name']}{STICKER}`, result]
                    ]))
                    return
                }
                case 5: {
                    let themeResult: DataElement[] = []
                    for (const item of data['redeem_item_id'].split("&")) {
                        let o = await fetch(`${APIPrefix}/api/garb/v2/user/suit/benefit?item_id=${item}&part=suit`).then(resp => resp.json())
                        themeResult = themeResult.concat(generateSkinList(o['data']))
                    }
                    resolve(new Map([
                        [`${data['redeem_item_name']}{THEME}`, themeResult]
                    ]))
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