<script setup lang="ts">
import 'mdui';
import 'mdui/mdui.css';
import 'vue3-tour/dist/vue3-tour.css';
import 'vue3-tour'

import {getCurrentInstance, watch} from "vue";
import {PortalTarget} from "portal-vue";
import type {Step, VTourOptions} from "vue3-tour";
import {snackbar} from "mdui";
import {tourSteps} from "~/util/global";
import {useStore} from "~/storages/useStore";

const instance = getCurrentInstance();

const route = useRoute()

const router = useRouter()

const r = ref<string>("")

let tour = ref<{
  steps: Step[],
  option: VTourOptions
}>({
  steps: [],
  option: {
    highlight: true,
    labels: {
      buttonNext: '下一个',
      buttonPrevious: '上一个',
      buttonSkip: '跳过引导',
      buttonStop: '关闭引导'
    }
  }
});

let store = useStore()

let f = route.path.split('/')[1]
r.value = f === "" ? "index" : f
let t = tourSteps.get(f)
tour.value.steps = t ? t : []

watch(() => route.path,(newValue) => {
  let f = newValue.split('/')[1]
  r.value = f === "" ? "index" : f
  let t = tourSteps.get(f)
  tour.value.steps = t ? t : []
})

function startTour(isChkToured = false) {
  const {proxy} = instance;
  if (proxy && proxy.$tours && proxy.$tours['tour']) {
    if (!(isChkToured && store.tour[r.value])) {
      if (tour.value.steps.length === 0) {
        snackbar({
          message: "当前页面没有引导数据",
          autoCloseDelay: 1000,
          closeable: true,
          closeOnOutsideClick: true,
        });
        return
      }
      proxy.$tours['tour'].start()
      store.tour[r.value] = true
    }
  } else {
    snackbar({
      message: "当前页面没有引导数据",
      autoCloseDelay: 1000,
      closeable: true,
      closeOnOutsideClick: true,
    });
  }
}

nextTick(() => {
  startTour(true)
})
</script>
<style lang="scss" scoped>
body {
  font-family: Roboto, Noto Sans SC, PingFang SC, Lantinghei SC, Microsoft Yahei, Hiragino Sans GB, "Microsoft Sans Serif", WenQuanYi Micro Hei, sans-serif;
  margin: 0;
}

mdui-top-app-bar,mdui-navigation-rail {
  position: fixed !important;
}
</style>
<template>
  <mdui-layout style="overflow: visible;">
    <mdui-top-app-bar scroll-behavior="elevate" variant="small">
      <mdui-top-app-bar-title style="margin-left: 45px">
        Collection Down
      </mdui-top-app-bar-title>
      <div style="flex-grow: 1"></div>
      <mdui-button-icon href="https://github.com/heartalborada-del/Collection-Down" target="_blank">
        <mdui-icon style="width: 30px; height: 30px;">
          <svg class="bi bi-github" fill="currentColor" height="16" viewBox="0 0 16 16" width="16"
               xmlns="http://www.w3.org/2000/svg">
            <path
                d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
          </svg>
        </mdui-icon>
      </mdui-button-icon>
    </mdui-top-app-bar>
    <mdui-navigation-rail :value="r">
      <mdui-navigation-rail-item icon="account_circle--outlined" value="index" @click="router.push('/')">Index</mdui-navigation-rail-item>
      <mdui-navigation-rail-item icon="search--outlined" value="search" @click="router.push('/search')">Search</mdui-navigation-rail-item>
      <mdui-navigation-rail-item icon="file_download--outlined" value="metadata" @click="router.push('/metadata')">Metadata</mdui-navigation-rail-item>
      <mdui-navigation-rail-item icon="info--outlined" value="about" @click="router.push('/about')">About</mdui-navigation-rail-item>
      <div slot="bottom">
        <mdui-button-icon data-v-step="startTour" icon='question_mark' @click="startTour(false)"></mdui-button-icon>
        <portal-target name="additional-navigation"/>
      </div>
    </mdui-navigation-rail>
    <mdui-layout-main style="overflow: visible" class="mdui-prose">
      <main>
        <NuxtLayout>
          <NuxtPage/>
        </NuxtLayout>
      </main>
    </mdui-layout-main>
  </mdui-layout>
  <v-tour :options="tour.option" :steps="tour.steps" name="tour"></v-tour>
</template>