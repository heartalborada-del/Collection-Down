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