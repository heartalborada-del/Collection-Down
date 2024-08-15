<style lang="scss">
@use 'assets/index.scss';
</style>
<script setup lang="ts">
import { ref } from 'vue';

let input = {
  search: "",
  resolvedURL: ""
}

const qrInput = ref<HTMLInputElement | null>(null);
function searchSubmit() {
  console.log(input.search)
}
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
        <input
            ref="qrInput"
            type="file"
            style="display: none; width: 0; height: 0;"
            accept="image/*"
        >
        <div class="stat pending">
          <label>等待中</label>
          <mdui-button variant="elevated" class="without radius" @click="">
            选择图片
            <mdui-icon slot="end-icon" name="attach_file"></mdui-icon>
          </mdui-button>
        </div>
      </div>
    </mdui-tab-panel>
    <mdui-tab-panel slot="panel" value="search">
      <form
          @submit.prevent="searchSubmit"
          style="display: flex;justify-content: center;align-items: stretch; border-radius: var(--mdui-shape-corner-small); overflow: hidden">
        <mdui-text-field
            :value="input.search"
            @input="input.search = $event.target.value"
            class="without radius" icon="search" label="关键词"></mdui-text-field>
        <mdui-button-icon class="without radius" variant="filled" icon="arrow_forward" style="height: auto" type="submit"></mdui-button-icon>
      </form>
      <mdui-divider></mdui-divider>
      <div class="container" ref="searchResult"></div>
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
  <p>获取该收藏集/装扮详情数据</p>

</template>