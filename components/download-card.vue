<script setup lang="ts">
import {APIPrefix} from "~/util/global";
import type {AnimateEmojiUrl} from "~/util/generate";

let props = defineProps<{
  name: string
  urls: string | AnimateEmojiUrl
}>();
let url: string;
if(typeof props.urls === 'string') {
  url = String(props.urls).replace(/http(s|):\/\/i0.hdslb.com\//, `${APIPrefix}/i0/`) + '@100w'
} else {
  url = String(props.urls.gif).replace(/http(s|):\/\/i0.hdslb.com\//, `${APIPrefix}/i0/`) + '@100w'
}
let cnt = 1;
</script>

<template>
  <mdui-card variant="filled" clickable>
    <div class="container">
      <img :src="url" :alt="name" @error="(e) => {
        if(cnt >= 5 || !e.target) return
        e.target.src = url + `?${new Date().getTime()};`;
        cnt++;
      }">
    </div>
  </mdui-card>
</template>

<style scoped lang="scss">
mdui-card[aria-checked=true] {
  & {
    transition:
        width 0.1s ease-in-out,
        border-color ease-in-out 0.1s;
    border: 0.15rem solid #2196f3;
  }
}
mdui-card {
  & {
    box-sizing: content-box;
    border: 0.15rem solid rgba(33, 150, 243, 0);
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