<script setup lang="ts">
import {APIPrefix} from "~/util/global";
import type {AnimateEmojiUrl} from "~/util/generate";
let props = defineProps<{
  name: string
  urls: string | AnimateEmojiUrl
}>();
let url: string;
if(typeof props.urls === 'string') {
  url = String(props.urls).replace(/http(s|):\/\/i0.hdslb.com\//, `${APIPrefix}/i0/`) + '@_80q_100w'
} else {
  url = String(props.urls.gif).replace(/http(s|):\/\/i0.hdslb.com\//, `${APIPrefix}/i0/`) + '@_80q_100w'
}
</script>

<template>
  <mdui-card variant="filled" clickable>
    <div class="container">
      <img :src="url" :alt="name" @error="">
    </div>
  </mdui-card>
</template>

<style scoped lang="scss">
  mdui-card {
    & {
      max-height: 30rem;
      border-radius: var(--mdui-shape-corner-extra-small);
    }
    div.container {
      max-width: 8rem;
      min-width: 40px;
      box-shadow: var(--mdui-elevation-level5);
      img {
        object-fit: contain;
        margin: 0;
        display: block;
        width: 100%;
        height: 100%;
      }
    }
  }
</style>