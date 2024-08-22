<style lang="scss">
@use 'assets/index';
</style>
<script setup lang="ts">
import {createVNode, ref, type VNode, watch} from 'vue';
import QrcodeDecoder from 'qrcode-decoder';
import {snackbar} from 'mdui';
import InfoCard from "~/components/info-card.vue";
import {buildJumpLink, getAPIUrl, getCollectionAPIUrl, isCollection, parseRespInfoData} from "~/util/utils";
import {
  type DataElement, type DataPromiseResult,
  generateCardList, generateCollectList,
  generateEmojiList,
  generateSkinList,
  generateSpaceBackgroundList
} from "~/util/generate";

const APIPrefix = '/bili/ts/'
const QRInput = ref<HTMLInputElement | null>(null);
const resultContainer = ref<HTMLDivElement | null>(null);

let input = ref({
  search: "",
  resolvedURL: ""
});

let labels = ref({
  QR: {
    class: 'pending',
    text: '等待中...'
  },
  urlStat: {
    classes: ["error"],
    text: '当前的URL未能获取到数据'
  }
});

let flags = {
  search: {
    is: true,
    key: ""
  },
}

const resultCardList = ref({
  list: new Array<VNode>,
  page: 0
});

function searchSubmit() {
  flags.search.key = input.value.search
  resultCardList.value = {
    list: new Array<VNode>,
    page: 0
  }
  loadMoreSearchData()
}

function loadMoreSearchData() {
  if (!flags.search.is) {
    return snackbar({
      message: "上一个搜索任务正在进行中",
      closeOnOutsideClick: true,
      autoCloseDelay: 1000,
    })
  }
  flags.search.is = false
  fetch(`${APIPrefix}/api/garb/v2/mall/home/search?key_word=${flags.search.key}&pn=${++resultCardList.value.page}`)
      .then(resp => resp.json())
      .then(async data => {
        if (data.code !== 0 || !data.data.list) {
          flags.search.is = true
          return snackbar({
            message: "搜索时遇到了一些问题",
            closeOnOutsideClick: true,
            autoCloseDelay: 1000,
          })
        }
        for (const node of data.data.list) {
          let jumpLink = node['jump_link']
          if (!jumpLink)
            jumpLink = buildJumpLink(node)
          let type = isCollection(jumpLink)
          if (typeof type !== 'boolean') {
            flags.search.is = true
            return snackbar({
              message: "搜索时遇到了一些问题",
              closeOnOutsideClick: true,
              autoCloseDelay: 1000,
            })
          }
          const VNode = createVNode(InfoCard, {
            imageUrl: `${String(node['properties']['image_cover']).replace(/http(s|):\/\/i0.hdslb.com\//, `${APIPrefix}/i0/`)}@progressive_80q_150w_.jpeg`,
            kv: parseRespInfoData(type, node),
            onClick: () => {
              input.value.resolvedURL = jumpLink
            }
          })
          resultCardList.value.list.push(VNode);
        }
        flags.search.is = true
      }).catch(err => {
    snackbar({
      message: "搜索时遇到了一些问题",
      closeOnOutsideClick: true,
      autoCloseDelay: 1000,
    })
    flags.search.is = true
    return console.log(err)
  })
}

function qrUpload(e: Event) {
  if (e.target instanceof HTMLInputElement && e.target.files && e.target.files.length > 0) {
    const URi = window.webkitURL.createObjectURL(e.target?.files[0]) || window.URL.createObjectURL(e.target?.files[0])
    const qr = new QrcodeDecoder();
    qr.decodeFromImage(URi)
        .then(data => {
          if (data?.data) {
            let url = data.data
            fetch("/bili/redirect", {
              method: "POST",
              body: JSON.stringify({
                url: url
              }),
              headers: {
                "Content-Type": "application/json"
              }
            }).then(resp => resp.json())
                .then(data => {
                  if (data.code !== 0) {
                    labels.value.QR.class = 'fail'
                    labels.value.QR.text = data.msg || "未知错误"
                    return
                  }
                  input.value.resolvedURL = data.rurl
                  labels.value.QR.class = 'success'
                  labels.value.QR.text = '成功'
                });
          } else {
            labels.value.QR.class = 'fail'
            labels.value.QR.text = '无法在上传的图片中识别到二维码!'
          }
        });
  } else {
    labels.value.QR.class = 'fail'
    labels.value.QR.text = '你是否选择了文件?'
  }
}

watch(() => input.value.resolvedURL,   (newValue, oldValue) => {
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
    let data = new Map<string, DataElement[] | Map<string,DataElement[]>>()
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
        map.set(`收藏集`, generateCardList(json.data))
        let other = await generateCollectList(json.data, APIPrefix)
        other.forEach((value, key) => {
            map.set(`${key.replace('{OTHER}','其他').replace('{STICKER}', '表情包')}`, value);
        });
        resolve({
          name: json['data']['name'],
          data: map
        })
      })))
      dataO.forEach((k:DataPromiseResult) => {
        data.set(k.name,k.data)
      })
      console.log(data)
    } else {
      data.set('背景', generateSpaceBackgroundList(json.data))
      data.set('表情包', generateEmojiList(json.data))
      data.set('主题图片', generateSkinList(json.data))
    }
  }).catch((e) => {
    labels.value.urlStat.classes = ['error']
    labels.value.urlStat.text = "请求数据时遇到了一些问题"
    console.error(e)
    return
  })
});
</script>
<template>
  <h1>让我们开始吧</h1>
  <h2 id="search">
    <a href="#search">Step 1</a>
  </h2>
  <p>进行关键词搜索或进行二维码识别</p>
  <mdui-tabs value="qr">
    <mdui-tab value="qr">
      二维码扫描
      <mdui-icon slot="icon" name="qr_code"></mdui-icon>
    </mdui-tab>
    <mdui-tab value="search">
      关键词搜索
      <mdui-icon slot="icon" name="search"></mdui-icon>
    </mdui-tab>
    <mdui-tab-panel slot="panel" value="qr">
      <div style="display: flex;justify-content: center;">
        <div class="stat" :class="labels.QR.class" ref="QRLabel">
          <input
              ref="QRInput"
              type="file"
              style="display: none; width: 0; height: 0;"
              accept="image/*"
              @change="qrUpload"
          >
          <label>{{ labels.QR.text }}</label>
          <mdui-button variant="elevated" class="without radius" @click="() => {if(QRInput !== null) QRInput.click();}">
            选择图片
            <mdui-icon slot="end-icon" name="attach_file"></mdui-icon>
          </mdui-button>
        </div>
      </div>
    </mdui-tab-panel>
    <mdui-tab-panel slot="panel" value="search" style="overflow: hidden;">
      <form
          @submit.prevent="searchSubmit"
          style="display: flex;justify-content: center;align-items: stretch; border-radius: var(--mdui-shape-corner-small); overflow: hidden; margin-bottom: 0;">
        <mdui-text-field
            :value="input.search"
            @input="input.search = $event.target.value"
            class="without radius" icon="search" label="关键词"></mdui-text-field>
        <mdui-button-icon class="without radius" variant="filled" icon="arrow_forward" style="height: auto"
                          type="submit"></mdui-button-icon>
      </form>
      <mdui-divider></mdui-divider>
      <div class="container" style="overflow: auto" ref="resultContainer">
        <component v-for="node in resultCardList.list" :is="node"></component>
        <div style="width: 100%; display: flex; justify-items: center; align-items: center; flex-direction: column"
             v-if="resultCardList.list.length > 0">
          <mdui-button style="width: 90%; max-width: 25rem" @click="loadMoreSearchData">
            <mdui-icon slot="icon" name="expand_more"></mdui-icon>
            戳我加载更多
          </mdui-button>
        </div>
      </div>
    </mdui-tab-panel>
  </mdui-tabs>
  <mdui-divider></mdui-divider>
  <mdui-text-field
      :value="input.resolvedURL"
      @input="input.resolvedURL = $event.target.value"
      icon="link" variant="outlined" label="URL"></mdui-text-field>
  <h2 id="metadata">
    <a href="#metadata">Step 2</a>
  </h2>
  <p>该收藏集/装扮详情数据</p>
  <mdui-divider></mdui-divider>
  <div style="display: block; position: relative;">
    <div style="height: 100%;width: 100%;position: absolute; display: flex; flex-direction: column">
      <stat style="position: sticky; top: 4.25rem; width: 100%; z-index: 1;" :classes="labels.urlStat.classes"
            :message="labels.urlStat.text"></stat>
    </div>
    <div style="height: 100%;width: 100%;position: absolute; display: flex; justify-content: flex-end; align-items: center ;flex-direction: column; ">
      <mdui-fab style="position: sticky;bottom: 1rem;right: 1rem" extended icon="edit">Settings</mdui-fab>
    </div>
    <div style="justify-content: center; align-items: center; margin: 0 .5rem; flex-direction: column">
      <div style="width: 100%; display: flex; position: static;">
        <div style="width: 100%">
          <mdui-tabs value="tab-1">
            <mdui-tab value="tab-1">Tab 1</mdui-tab>
            <mdui-tab value="tab-2">Tab 2</mdui-tab>
            <mdui-tab value="tab-3">Tab 3</mdui-tab>

            <mdui-tab-panel slot="panel" value="tab-1">
              <mdui-tabs value="tab-1">
                <mdui-tab value="tab-1">Tab 1</mdui-tab>
                <mdui-tab value="tab-2">Tab 2</mdui-tab>
                <mdui-tab value="tab-3">Tab 3</mdui-tab>

                <mdui-tab-panel slot="panel" value="tab-1">Panel 1</mdui-tab-panel>
                <mdui-tab-panel slot="panel" value="tab-2">Panel 2</mdui-tab-panel>
                <mdui-tab-panel slot="panel" value="tab-3">Panel 3</mdui-tab-panel>
              </mdui-tabs>
            </mdui-tab-panel>
            <mdui-tab-panel slot="panel" value="tab-2">Panel 2</mdui-tab-panel>
            <mdui-tab-panel slot="panel" value="tab-3">Panel 3</mdui-tab-panel>
          </mdui-tabs>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
          content<br/>
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