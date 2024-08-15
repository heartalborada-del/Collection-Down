<script setup lang="ts">
import 'mdui';
import 'mdui/mdui.css';
import { ref } from 'vue';
const drawer = ref<HTMLInputElement | null>(null);

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
  <mdui-layout style="position: relative; overflow: hidden;">
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
        order="-1"
    >
    </mdui-navigation-drawer>
    <mdui-layout-main style="min-height: 100vh" class="mdui-prose">
      <main>
        <NuxtLayout>
          <NuxtPage/>
        </NuxtLayout>
      </main>
    </mdui-layout-main>
  </mdui-layout>
</template>