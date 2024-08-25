<script setup lang="ts">
import 'mdui';
import 'mdui/mdui.css';
import {watch} from "vue";
import {PortalTarget} from "portal-vue";

const route = useRoute()

const router = useRouter()

const r = ref<string>("")

let f = route.path.split('/')[1]
r.value = f === "" ? "index" : f

watch(() => route.path,(newValue) => {
  let f = newValue.split('/')[1]
  r.value = f === "" ? "index" : f
})
</script>
<style scoped lang="css">
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
    </mdui-navigation-rail>
    <mdui-layout-main style="overflow: visible" class="mdui-prose">
      <main>
        <NuxtLayout>
          <NuxtPage/>
        </NuxtLayout>
      </main>
    </mdui-layout-main>
  </mdui-layout>
</template>