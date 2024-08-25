<style scoped lang="scss">
@use 'assets/index';
@use 'assets/metadata';
</style>

<script setup lang="ts">
import {createVNode, ref, type VNode, watch} from "vue";
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
import DownloadCard from "~/components/download-card.vue";
import Keys from "~/components/keys.vue";

const route = useRoute()

let Details = ref({
  Data: new Map<string,DataElement[]>,
  Selected: new Map<string,Map<string,DataElement>>
})

let ResultNodes = ref<Array<VNode>>(new Array<VNode>)

let labels = ref({
  urlStat: {
    classes: ["error"],
    text: '当前的URL未能获取到数据'
  },
  selectAll: {
    indeterminate: false,
    selected: false,
    value: false
  },
  display: {
    isRefresh: false
  }
});

let input = ref({
  resolvedURL: "",
  select: ""
});

function toggleSelectDataStat(parent: string, name: string) {
  if(!Details.value.Selected.has(parent)) {
    Details.value.Selected.set(parent, new Map<string,DataElement>())
  }
  let o = Details.value.Data.get(parent)
  if (!o) return
  let v = Details.value.Selected.get(parent)
  if(v?.get(name)) {
    v?.delete(name)
    labels.value.selectAll.selected = v !== undefined && v.size === o.length
    labels.value.selectAll.indeterminate = !labels.value.selectAll.selected && v !== undefined && v.size > 0 && v.size < o.length
    return;
  }
  for (let e of o) {
    if (e.name === name) {
      v?.set(name,e)
      labels.value.selectAll.selected = v !== undefined && v.size === o.length
      labels.value.selectAll.indeterminate = !labels.value.selectAll.selected && v !== undefined && v.size > 0 && v.size < o.length
    }
  }
}

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
            key = `${k.name}{COLLECTION}`
          } else if (ke.includes("{OTHER}")) {
            key = `${k.name}{OTHER}`
          } else if (ke.includes("{STICKER}")) {
            key = ke
          }
          if(key && !data.has(key)) data.set(key,v)
        })
      })
    } else {
      data.set(`${json.data.name}{BACKGROUND}`, generateSpaceBackgroundList(json.data))
      data.set(`${json.data.name}{STICKER}`, generateEmojiList(json.data))
      data.set(`${json.data.name}{THEME}`, generateSkinList(json.data))
      console.log(data)
    }
    Details.value.Data = data
  }).catch((e) => {
    labels.value.urlStat.classes = ['error']
    labels.value.urlStat.text = "请求数据时遇到了一些问题"
    console.error(e)
    return
  })
});

watch(() => input.value.select, (newValue) => {
  if(!Details.value.Selected.has(input.value.select) && Details.value.Data.has(newValue)) {
    Details.value.Selected.set(input.value.select, new Map<string,DataElement>())
  }
  let temp = new Array<VNode>()
  let o = Details.value.Data.get(newValue)
  labels.value.display.isRefresh = true
  let v = Details.value.Selected.get(newValue)
  labels.value.selectAll.selected = v !== undefined && o !== undefined && v.size === o.length
  labels.value.selectAll.indeterminate = !labels.value.selectAll.selected && v !== undefined && o !== undefined && v.size > 0 && v.size < o.length
  if(!o) {
    labels.value.display.isRefresh = false
    return;
  }
  for (const v of o) {
    temp.push(createVNode(DownloadCard,{
      name: v.name,
      urls: v.url,
    }))
  }
  nextTick(() => {
    ResultNodes.value = temp
    labels.value.display.isRefresh = false
  })
});

watch(() => labels.value.selectAll.value, (newValue) => {
  let o = Details.value.Data.get(input.value.select)
  let v = Details.value.Selected.get(input.value.select)
  if (!o || !v) return
  if(newValue) {
    for (let e of o) {
      v?.set(e.name,e)
    }
    labels.value.selectAll.selected = true
    labels.value.selectAll.indeterminate = false
  } else {
    v?.clear()
    labels.value.selectAll.selected = false
    labels.value.selectAll.indeterminate = false
  }
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
    <div style="justify-content: center; align-items: center; margin: 0 .5rem; flex-direction: column">
      <div style="width: 100%; display: flex; position: static;">
        <div id="data-result" style="width: 100%; min-height: 30rem;">
          <div style="display: flex;flex-direction: row">
            <mdui-select class="rotate-icon" :value="input.select" @change="input.select = $event.target.value">
              <template v-for="key in Details.Data.keys()">
                <mdui-menu-item :value="key">
                  <p style="text-align: center">
                    <keys :keys="key"/>
                  </p>
                </mdui-menu-item>
              </template>
              <mdui-button-icon slot="end-icon" icon="keyboard_arrow_down" disabled></mdui-button-icon>
            </mdui-select>
            <mdui-checkbox v-if="!labels.display.isRefresh" :disabled="!Details.Data.has(input.select)" style="min-width: 4rem"
                           :indeterminate="labels.selectAll.indeterminate"
                           :checked="labels.selectAll.selected"
                           @change="labels.selectAll.value = $event.target.checked"
            >
              <p style="white-space: nowrap">全选</p>
            </mdui-checkbox>
          </div>
          <div v-if="Details.Data.has(input.select) && !labels.display.isRefresh" style="gap: .5rem;display: flex; flex-wrap: wrap;justify-content: center;align-items: center;flex-direction: row;margin-top: .5rem">
            <component v-for="node in ResultNodes" :is="node" @click="toggleSelectDataStat(input.select, node.props?.name)" :aria-checked="Details.Selected.get(input.select)?.has(node.props?.name)"></component>
          </div>
        </div>
        <div
            id="data-select"
            style="display: none; width: 17.25rem; min-width: 17.25rem; margin: .5rem 0 1rem 1.5rem; position: sticky; box-sizing: border-box; height: calc(100vh - 12rem); top: 6rem;">
          <mdui-card style="min-height: 20rem; max-height: calc(100vh - 12rem); width: 100%; box-shadow: var(--mdui-elevation-level5); " class="float-card">
            <mdui-list style="padding: unset;min-height: 20rem; max-height: calc(100vh - 12rem); overflow: auto">
              <mdui-collapse accordion>
                <template v-for="key in Details.Selected.keys()">
                  <mdui-collapse-item v-if="Details.Selected.get(key)?.size !== 0">
                    <mdui-list-item slot="header" icon="data_array--outlined">
                      <p style="text-align: center">
                        <keys :keys="key"/>
                      </p>
                    </mdui-list-item>
                    <div style="margin-left: 2.5rem">
                      <mdui-list-item v-for="data of Details.Selected.get(key)?.keys()">
                        <mdui-checkbox checked @change="toggleSelectDataStat(key,data)">{{data}}</mdui-checkbox>
                      </mdui-list-item>
                    </div>
                  </mdui-collapse-item>
                </template>
              </mdui-collapse>
            </mdui-list>
          </mdui-card>
        </div>
      </div>
    </div>
  </div>
</template>


