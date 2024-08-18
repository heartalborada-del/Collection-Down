<script setup lang="ts">
import 'mdui';
import 'mdui/mdui.css';
import { ref } from 'vue';
const drawer = ref<HTMLElement | null>(null);

const toggleDrawer = () => {
  if(drawer.value)
    drawer.value.open = !drawer.value.open;
};
</script>
<style lang="css">
  mdui-top-app-bar {
    position: fixed !important;
  }
</style>
<template>
  <mdui-layout style="overflow: visible;">
    <mdui-top-app-bar scroll-behavior="elevate" variant="small">
      <mdui-button-icon
          @click="toggleDrawer"
          icon="menu"></mdui-button-icon>
      <mdui-top-app-bar-title>
        Collection Down
      </mdui-top-app-bar-title>
    </mdui-top-app-bar>
    <mdui-navigation-drawer
        ref="drawer"
        close-on-esc
        close-on-overlay-click
    >
      <mdui-list>
        <mdui-collapse accordion value="start">
          <mdui-collapse-item value="start">
            <mdui-list-item slot="header" icon="near_me" rounded>主页</mdui-list-item>
            <div style="margin-left: 2.5rem">
              <mdui-list-item href="/#search" rounded>Step 1</mdui-list-item>
              <mdui-list-item href="/#metadata" rounded>Step 2</mdui-list-item>
            </div>
          </mdui-collapse-item>
          <mdui-list-item icon="info" href="/about" rounded>关于</mdui-list-item>
        </mdui-collapse>
      </mdui-list>
    </mdui-navigation-drawer>
    <mdui-layout-main style="overflow: visible" class="mdui-prose">
      <main>
        <NuxtLayout>
          <NuxtPage/>
        </NuxtLayout>
      </main>
    </mdui-layout-main>
  </mdui-layout>
</template>