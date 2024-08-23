<style lang="scss">
@use 'assets/index';
</style>

<script setup lang="ts">
import {ref, watch} from "vue";
import {getAPIUrl, getCollectionAPIUrl, isCollection} from "~/util/utils";
import {snackbar} from "mdui";
import {
  type DataElement,
  type DataPromiseResult,
  generateCardList,
  generateCollectList, generateEmojiList, generateSkinList,
  generateSpaceBackgroundList
} from "~/util/generate";
import {APIPrefix} from "~/util/global";

const route = useRoute()

let DetailData = ref<Map<string,DataElement[]>>(new Map<string,DataElement[]>)

let labels = ref({
  urlStat: {
    classes: ["error"],
    text: '当前的URL未能获取到数据'
  }
});

let input = ref({
  resolvedURL: ""
});

watch(() => input.value.resolvedURL,   (newValue) => {
  let collection = isCollection(newValue)
  let api = getAPIUrl(newValue,APIPrefix)
  if (collection === null || !api) {
    labels.value.urlStat.classes = ['error']
    labels.value.urlStat.text = "当前的URL未能获取到数据"
    return
  }
  fetch(api).then(resp => resp.json()).then(async json => {
    if (json.code !== 0 || !json.data) {
      return snackbar({
        message: "请求数据时遇到了一些问题",
        closeOnOutsideClick: true,
        autoCloseDelay: 1000,
      })
    }
    labels.value.urlStat.classes = ['success']
    labels.value.urlStat.text = "成功"
    let data = new Map<string, DataElement[]>()
    if (collection) {
      let dataO = await Promise.all(json['data']['lottery_list'].map((out:any) => new Promise<DataPromiseResult>(async (resolve) => {
        let map = new Map<string,DataElement[]>
        let api = getCollectionAPIUrl(newValue, out['lottery_id'], APIPrefix)
        if(!api) {
          labels.value.urlStat.classes = ['error']
          labels.value.urlStat.text = "请求数据时遇到了一些问题"
          return
        }
        let json = await fetch(api).then(resp => resp.json())
        map.set("{MAIN}", generateCardList(json.data))
        let other = await generateCollectList(json.data, APIPrefix)
        other.forEach((value, key) => {
          map.set(key, value);
        });
        resolve({
          name: json['data']['name'],
          data: map
        })
      })))
      dataO.forEach((k:DataPromiseResult) => {
        k.data.forEach((v,ke) => {
          let key = null;
          if(ke.includes("{MAIN}")) {
            key = `${k.name}{MAIN}`
          } else if (ke.includes("{OTHER}")) {
            key = `${k.name}{OTHER}`
          } else if (ke.includes("{STICKER}")) {
            key = ke
          }
          if(key && !data.has(key)) data.set(key,v)
        })
      })
    } else {
      data.set('背景', generateSpaceBackgroundList(json.data))
      data.set('表情包', generateEmojiList(json.data))
      data.set('主题图片', generateSkinList(json.data))
    }
    DetailData.value = data
  }).catch((e) => {
    labels.value.urlStat.classes = ['error']
    labels.value.urlStat.text = "请求数据时遇到了一些问题"
    console.error(e)
    return
  })
});

if(route.query.hasOwnProperty("url")) {
  if (typeof route.query['url'] === 'string')
    input.value.resolvedURL = atob(route.query['url'])
}

</script>

<template>
  <p>该收藏集/装扮详情数据</p>
  <mdui-divider></mdui-divider>
  <mdui-text-field
      :value="input.resolvedURL"
      @input="input.resolvedURL = $event.target.value"
      icon="link" variant="outlined" label="URL"></mdui-text-field>
  <mdui-divider></mdui-divider>
  <div style="display: block; position: relative;">
    <div style="height: 100%;width: 100%;position: absolute; display: flex; flex-direction: column">
      <stat style="position: sticky; top: 4.25rem; width: 100%; z-index: 1; pointer-events: none;" :classes="labels.urlStat.classes"
            :message="labels.urlStat.text"></stat>
    </div>
    <div style="height: 100%;width: 100%;position: absolute; display: flex; justify-content: flex-end; align-items: center ;flex-direction: column; ">
      <mdui-fab style="position: sticky;bottom: 1rem;right: 1rem" extended icon="edit">Settings</mdui-fab>
    </div>
    <div style="justify-content: center; align-items: center; margin: 0 .5rem; flex-direction: column">
      <div style="width: 100%; display: flex; position: static;">
        <div style="width: 100%; min-height: 30rem">
          <mdui-select class="rotate-icon">
            <template v-for="key in DetailData.keys()">
              <mdui-menu-item :value="key">
                <p style="text-align: center">
                  <strong>{{ key.replaceAll(/{[a-zA-Z]+}/g,"") }}</strong>
                  <template v-if="key.includes('{MAIN}')"> - 收藏集</template>
                  <template v-else-if="key.includes('{STICKER}')"> - 表情包</template>
                  <template v-if="key.includes('{OTHER}')"> - 其他</template>
                </p>
              </mdui-menu-item>
            </template>
            <mdui-button-icon slot="end-icon" icon="keyboard_arrow_down" disabled></mdui-button-icon>
          </mdui-select>
        </div>
        <div
            id="data-result"
            style="display: none; width: 17.25rem; min-width: 17.25rem; margin: 1.5rem 0 1rem 1.5rem; position: sticky; box-sizing: border-box; height: calc(100vh - 12rem); top: 6rem;">
          <mdui-card style="min-height: 20rem; max-height: calc(100vh - 12rem); width: 100%; box-shadow: var(--mdui-elevation-level5); " class="float-card">
            <mdui-list style="padding: unset;min-height: 20rem; max-height: calc(100vh - 12rem); overflow: auto">
              <mdui-collapse value="item-1">
                <mdui-collapse-item value="item-1">
                  <mdui-list-item slot="header" icon="near_me">Item 1</mdui-list-item>
                  <div style="margin-left: 2.5rem">
                    <mdui-list-item>
                      <mdui-checkbox>111</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>222</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>333</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>444</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>111</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>222</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>333</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>444</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>111</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>222</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>333</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>444</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>111</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>222</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>333</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>444</mdui-checkbox>
                    </mdui-list-item>
                  </div>
                </mdui-collapse-item>
                <mdui-collapse-item value="item-2">
                  <mdui-list-item slot="header" icon="near_me">Item 2</mdui-list-item>
                  <div style="margin-left: 2.5rem">
                    <mdui-list-item>
                      <mdui-checkbox>111</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>222</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>333</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>444</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>111</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>222</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>333</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>444</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>111</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>222</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>333</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>444</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>111</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>222</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>333</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>444</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>111</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>222</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>333</mdui-checkbox>
                    </mdui-list-item>
                    <mdui-list-item>
                      <mdui-checkbox>444</mdui-checkbox>
                    </mdui-list-item>
                  </div>
                </mdui-collapse-item>
              </mdui-collapse>
            </mdui-list>
          </mdui-card>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">

</style>