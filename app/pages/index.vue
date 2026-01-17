<script setup lang="ts">

</script>

<template>
  <div>
    <h1 class="font-bold text-3xl">这是什么项目</h1>
    <USeparator class="mt-1 mb-2" size="md" />
    <p class="leading-7">如你所见，这是一个适用于b站装扮以及收藏集下载的项目</p>
    <p class="leading-7">此项目旨在给予B站用户更好的站装扮以及收藏集下载体验</p>
    <USeparator class="mt-4 mb-2" size="md" />
    <h2 class="font-bold text-2xl">镜像站点</h2>
    <USeparator class="mt-1 mb-2" size="md" />
    <p class="leading-7">如果你无法访问主站点，可以尝试以下镜像站点：</p>
    <p class="flex items-center gap-2 whitespace-nowrap">
      目前分流到
      <img alt="Netlify Deploy"
        src="https://img.shields.io/netlify/63f96f92-e29f-489a-b1e2-f79570c7e323?style=flat-square&logo=netlify"
        style="margin-bottom: 0">
      <a href="https://cd-netlify.griseo.top" class="underline">netlify</a>
      与
      <img alt="Vercel Deploy" src="https://deploy-badge.vercel.app/vercel/collection-down?style=flat-square"
        style="margin-bottom: 0">
      <a href="https://cd-vercel.griseo.top" class="underline">vercel</a>
    </p>
  </div>
</template>