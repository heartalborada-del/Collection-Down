<style scoped lang="scss">
@use 'assets/index';
</style>
<script setup lang="ts">
import {createVNode, ref, type VNode} from 'vue';
import QrcodeDecoder from 'qrcode-decoder';
import {snackbar,confirm} from 'mdui';
import InfoCard from "~/components/info-card.vue";
import {buildJumpLink, isCollection, parseRespInfoData} from "~/util/utils";
import {APIPrefix} from "~/util/global";

const router = useRouter();

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
              confirmJump(jumpLink)
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
                  confirmJump(data.rurl)
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

function confirmJump(turl:string) {
  confirm({
    headline: "是否跳转到资源获取界面",
    confirmText: "确定",
    cancelText: "取消",
    onConfirm: () => {
      router.push(`/metadata?url=${btoa(turl)}`);
    },
    onCancel: () => {},
  });
}
</script>
<template>
  <p>进行关键词搜索或进行二维码识别</p>
  <mdui-tabs value="qr">
    <mdui-tab value="qr">
      二维码扫描
      <mdui-icon slot="icon" name="qr_code_scanner--outlined"></mdui-icon>
    </mdui-tab>
    <mdui-tab value="search">
      关键词搜索
      <mdui-icon slot="icon" name="search--outlined"></mdui-icon>
    </mdui-tab>
    <mdui-tab-panel slot="panel" value="qr">
      <div style="display: flex;justify-content: center; margin-top: .5rem">
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
            <mdui-icon slot="end-icon" name="attach_file--outlined"></mdui-icon>
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
            <mdui-icon slot="icon" name="expand_more--outlined"></mdui-icon>
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
</template>