<style scoped lang="scss">
@use 'assets/index';
@use 'assets/metadata';
</style>

<script setup lang="ts">
import {createVNode, ref, type VNode, watch} from "vue";
import {formatDateWithDefaultOffset, getAPIUrl, getCollectionAPIUrl, isCollection} from "~/util/utils";
import {snackbar} from "mdui";
import {
  type AnimateEmojiUrl,
  type DataElement,
  type DataPromiseResult,
  generateCardList,
  generateCollectList,
  generateEmojiList,
  generateSkinList,
  generateSpaceBackgroundList
} from "~/util/generate";
import {APIPrefix} from "~/util/global";
import DownloadCard from "~/components/download-card.vue";
import Keys from "~/components/keys.vue";
import {Portal} from "portal-vue";
import JSZip from "jszip";
import mime from 'mime/lite';
import {useStore} from "~/storages/useStore";
import {Downloader} from "~/util/downloader";
import FileSaver from "file-saver";

const store = useStore()
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
    isCardRefresh: false
  }
});

let input = ref({
  resolvedURL: "",
  select: ""
});

let downloadDetails = ref({
  isDownloading: false,
  zipFile: null as JSZip | null,
  downloader: null as Downloader | null,
  downloadData: {} as Record<string, {
    isSucceeded: boolean,
    isFailed: boolean,
    reDownload: () => Promise<void>,
    progress: number
  }>,
})

const settingPanel = ref<HTMLDivElement | null>(null);

const downloadPanel = ref<HTMLDivElement | null>(null);

function toggleSelectDataStat(parent: string, name: string) {
  if(!Details.value.Selected.has(parent)) {
    Details.value.Selected.set(parent, new Map<string,DataElement>())
  }
  let o = Details.value.Data.get(parent)
  if (!o) return
  let v = Details.value.Selected.get(parent)
  if(v?.get(name)) {
    v?.delete(name)
    if (parent === input.value.select) {
      labels.value.selectAll.selected = v !== undefined && v.size === o.length
      labels.value.selectAll.indeterminate = !labels.value.selectAll.selected && v !== undefined && v.size > 0 && v.size < o.length
    }
    return;
  }
  for (let e of o) {
    if (e.name === name) {
      v?.set(name,e)
      if (parent === input.value.select) {
        labels.value.selectAll.selected = v !== undefined && v.size === o.length
        labels.value.selectAll.indeterminate = !labels.value.selectAll.selected && v !== undefined && v.size > 0 && v.size < o.length
      }
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
  let v = Details.value.Selected.get(newValue)
  labels.value.selectAll.selected = v !== undefined && o !== undefined && v.size === o.length
  labels.value.selectAll.indeterminate = !labels.value.selectAll.selected && v !== undefined && o !== undefined && v.size > 0 && v.size < o.length
  if (!o) return;
  labels.value.display.isCardRefresh = true
  labels.value.selectAll.value = false
  for (const v of o) {
    temp.push(createVNode(DownloadCard,{
      name: v.name,
      urls: v.url,
    }))
  }
  nextTick(() => {
    ResultNodes.value = temp
    labels.value.display.isCardRefresh = false
  })
});

watch(() => labels.value.selectAll.value, (newValue) => {
  let o = Details.value.Data.get(input.value.select)
  let v = Details.value.Selected.get(input.value.select)
  if (!o || !v) return
  if (newValue && !labels.value.display.isCardRefresh) {
    for (let e of o) {
      v?.set(e.name,e)
    }
    labels.value.selectAll.selected = true
    labels.value.selectAll.indeterminate = false
  } else if (!labels.value.display.isCardRefresh) {
    v?.clear()
    labels.value.selectAll.selected = false
    labels.value.selectAll.indeterminate = false
  }
});

if(route.query.hasOwnProperty("url")) {
  if (typeof route.query['url'] === 'string')
    input.value.resolvedURL = atob(route.query['url'])
}

function download() {
  let getSize = () => {
    let cnt = 0;
    for (const value of Details.value.Selected.values()) {
      cnt += value.size;
    }
    return cnt;
  }
  if (Details.value.Selected.size === 0 || getSize() === 0) {
    return snackbar({
      message: "还还没有选择下载内容",
      closeOnOutsideClick: true,
      autoCloseDelay: 1000,
    });
  }
  if (downloadPanel.value) downloadPanel.value.open = true
  if (downloadDetails.value.isDownloading) {
    return snackbar({
      message: "上一个下载任务还在进行中",
      closeOnOutsideClick: true,
      autoCloseDelay: 1000,
    });
  }
  downloadDetails.value.isDownloading = true;
  let copy = new Map(Details.value.Selected);
  downloadDetails.value.downloadData = {};
  downloadDetails.value.zipFile = new JSZip();
  downloadDetails.value.downloader = new Downloader(store.settings.download.parallelThread);
  const segment = store.settings.download.segmentThread;
  const promises = [] as Promise<any>[];
  copy.forEach((v, k) => {
    let name = k.replaceAll(/{[a-zA-Z]+}/g, "")
    let label = k.match(/{[a-zA-Z]+}/g)
    let folder: JSZip | null | undefined = downloadDetails.value.zipFile;
    if (label) {
      switch (label[0]) {
        case '{COLLECTION}': {
          folder = downloadDetails.value.zipFile?.folder("收藏集")
          break
        }
        case '{STICKER}': {
          folder = downloadDetails.value.zipFile?.folder("表情包")
          break
        }
        case '{THEME}': {
          folder = downloadDetails.value.zipFile?.folder("主题图片")
          break
        }
        case '{OTHER}': {
          folder = downloadDetails.value.zipFile?.folder("其他")
          break
        }
        case '{BACKGROUND}': {
          folder = downloadDetails.value.zipFile?.folder("背景")
          break
        }
      }
    }
    folder = folder?.folder(name)
    if (!folder) {
      console.error(`Some thing went wrong, when packing '${name}'`)
      return snackbar({
        message: "上一个下载任务还在进行中",
        closeOnOutsideClick: true,
        autoCloseDelay: 1000,
      })
    }
    v.forEach((v2, k2) => {
      if (typeof v2.url === 'string') {
        if (v2.videoUrl) {
          let videoFolder = folder?.folder('video')
          const fun = async () => {
            return downloadDetails.value.downloader?.addDownload({
              url: String(v2.videoUrl).replace(/http(s|):\/\/[a-zA-z\-]*.(bilivideo.com|akamaized.net)\//, `${APIPrefix}/upos/`),
              threadCount: segment,
              onProgress: (downloadedBytes, totalBytes) => {
                downloadDetails.value.downloadData[`${k2}{video}`].progress = Number((downloadedBytes / totalBytes).toFixed(2))
              }
            }).then(data => {
              let ext = mime.getExtension(data.type);
              if (!ext) ext = 'bin'
              videoFolder?.file(`${k2}.${ext}`, data.blob);
              downloadDetails.value.downloadData[`${k2}{video}`].isSucceeded = true
            }).catch(() => {
              downloadDetails.value.downloadData[`${k2}{video}`].isFailed = true
            })
          }
          downloadDetails.value.downloadData[`${k2}{video}`] = {
            isFailed: false,
            isSucceeded: false,
            progress: 0,
            reDownload: fun
          }
          promises.push(fun())
        }
        const imgFolder = folder?.folder('png')
        const fun = async () => {
          return downloadDetails.value.downloader?.addDownload({
            url: String(v2.url).replace(/http(s|):\/\/i0.hdslb.com\//, `${APIPrefix}/i0/`),
            threadCount: segment,
            onProgress: (downloadedBytes, totalBytes) => {
              downloadDetails.value.downloadData[`${k2}{image}`].progress = Number((downloadedBytes / totalBytes).toFixed(2))
            }
          }).then(data => {
            let ext = mime.getExtension(data.type);
            if (!ext) ext = 'bin'
            imgFolder?.file(`${k2}.${ext}`, data.blob);
            downloadDetails.value.downloadData[`${k2}{image}`].isSucceeded = true
          }).catch(() => {
            downloadDetails.value.downloadData[`${k2}{image}`].isFailed = true
          })
        }
        downloadDetails.value.downloadData[`${k2}{image}`] = {
          isFailed: false,
          isSucceeded: false,
          progress: 0,
          reDownload: fun
        }
        promises.push(fun())
      } else {
        const u = v2.url as AnimateEmojiUrl
        for (const urlKey in u) {
          let imgFolder = folder?.folder(urlKey)
          const fun = async () => {
            return downloadDetails.value.downloader?.addDownload({
              url: u[urlKey].replace(/http(s|):\/\/i0.hdslb.com\//, `${APIPrefix}/i0/`),
              threadCount: segment,
              onProgress: (downloadedBytes, totalBytes) => {
                downloadDetails.value.downloadData[`${k2}{${urlKey}}`].progress = Number((downloadedBytes / totalBytes).toFixed(2))
              }
            }).then(data => {
              let ext = mime.getExtension(data.type);
              if (!ext) ext = 'bin'
              imgFolder?.file(`${k2}.${ext}`, data.blob);
              downloadDetails.value.downloadData[`${k2}{${urlKey}}`].isSucceeded = true
            }).catch(() => {
              downloadDetails.value.downloadData[`${k2}{${urlKey}}`].isFailed = true
            })
          }
          downloadDetails.value.downloadData[`${k2}{${urlKey}}`] = {
            isFailed: false,
            isSucceeded: false,
            progress: 0,
            reDownload: fun
          }
          promises.push(fun())
        }
      }
    })
  })
  Promise.allSettled(promises).then(() => {
    downloadDetails.value.isDownloading = false
  }).catch((e) => {
    downloadDetails.value.isDownloading = false
    console.error(e)
  })
}

</script>

<template>
  <p>该收藏集/装扮详情数据</p>
  <mdui-divider></mdui-divider>
  <mdui-text-field
      data-v-step="URL"
      :value="input.resolvedURL"
      @input="input.resolvedURL = $event.target.value"
      icon="link" variant="outlined" label="URL"></mdui-text-field>
  <mdui-divider></mdui-divider>
  <div style="display: block; position: relative;">
    <div style="height: 100%;width: 100%;position: absolute; display: flex; flex-direction: column">
      <stat :classes="labels.urlStat.classes" style="position: sticky; top: 4.25rem; width: 100%; z-index: 1;"
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
            <mdui-checkbox v-if="!labels.display.isCardRefresh" :disabled="!Details.Data.has(input.select)"
                           style="min-width: 4rem"
                           :indeterminate="labels.selectAll.indeterminate"
                           :checked="labels.selectAll.selected"
                           @change="labels.selectAll.value = $event.target.checked"
            >
              <p style="white-space: nowrap">全选</p>
            </mdui-checkbox>
          </div>
          <div v-if="Details.Data.has(input.select) && !labels.display.isCardRefresh"
               style="gap: .5rem;display: flex; flex-wrap: wrap;justify-content: center;align-items: center;flex-direction: row;margin-top: .5rem">
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
                        <mdui-checkbox :key="data + 'Card'" checked @change="toggleSelectDataStat(key,data)">{{ data }}
                        </mdui-checkbox>
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
  <mdui-dialog
      ref="settingPanel"
      class="panel"
      close-on-overlay-click
      headline="Setting Panel"
  >
    <h2 style="margin-bottom: unset;">下载设置</h2>
    <div style="display: grid;margin-left: .5rem;grid-template-columns: 100px auto;align-items: center">
      <label style="white-space: nowrap">并行任务数</label>
      <mdui-slider :labelFormatter="(num: number) => {
        if (num === 0) store.settings.download.parallelThread = 2
        return Number(num)
      }" :value="store.settings.download.parallelThread"
                   max="8"
                   @change="store.settings.download.parallelThread = Number($event.target?.value)"></mdui-slider>
      <label style="white-space: nowrap">下载线程数量</label>
      <mdui-slider :labelFormatter="(num: number) => {
        if (num === 0) store.settings.download.segmentThread = 2
        return Number(num)
      }" :value="store.settings.download.segmentThread"
                   max="8"
                   @change="store.settings.download.segmentThread = Number($event.target?.value)"></mdui-slider>
    </div>
    <mdui-button slot="action" variant="text" @click="() => {
      if(settingPanel) settingPanel.open = false
    }">关闭
    </mdui-button>
  </mdui-dialog>
  <mdui-dialog
      ref="downloadPanel"
      class="panel download"
      headline="Download Progress">
    <div style="display: flex;flex-direction: column;row-gap: 0.25rem">
      <div v-for="(v,k) in downloadDetails.downloadData" :key="k"
           class="progress"
           style="display: flex;align-items: center;column-gap: .75rem"
      >
        <p style="display: flex;margin: unset;white-space: nowrap;align-items: center;column-gap: .25rem">
          <mdui-badge variant="large">
            <template v-if="k.includes('{video}')">MP4</template>
            <template v-else-if="k.includes('{image}') || k.includes('{static}')">PNG</template>
            <template v-else-if="k.includes('{gif}')">GIF</template>
            <template v-else-if="k.includes('{webp}')">WEBP</template>
          </mdui-badge>
          <label>{{ k.replaceAll(/{[a-zA-Z]+}/g, "") }}</label>
        </p>
        <div style="flex-grow: 1"></div>
        <mdui-linear-progress :class="{succeeded: v.isSucceeded, failed: v.isFailed}"
                              :value="v.progress"></mdui-linear-progress>
        <mdui-button-icon :disabled="!v.isFailed" icon="refresh" variant="filled" @click="() => {
          if (v.isFailed) {
            v.reDownload()
            v.isFailed = false;
          }
        }"></mdui-button-icon>
      </div>
    </div>
    <mdui-button slot="action" variant="text" @click="() => {
      if(downloadDetails.isDownloading) {
        downloadDetails.downloader?.cancelAllDownloads();
        downloadDetails.isDownloading = false
      }
      if(downloadPanel) downloadPanel.open = false
    }">取消
    </mdui-button>
    <mdui-button slot="action" :disabled="downloadDetails.isDownloading" variant="text" @click="() => {
      if(downloadDetails.zipFile) {
        downloadDetails.zipFile.generateAsync({type: 'blob'}).then((binary) => {
          FileSaver.saveAs(binary, `${formatDateWithDefaultOffset(new Date(),'',true)}.zip`)
        })
      }
      if(downloadPanel) downloadPanel.open = false;
    }">保存并退出
    </mdui-button>
  </mdui-dialog>
  <portal to="additional-navigation">
    <mdui-button-icon data-v-step="download" icon='download' @click="download"></mdui-button-icon>
    <mdui-button-icon data-v-step="setting" icon="settings" @click="() => {
      if(settingPanel) settingPanel.open = true
    }"></mdui-button-icon>
  </portal>
</template>


