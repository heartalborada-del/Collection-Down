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
      <a href="https://cd-netlify.griseo.top" class="underline flex">
        <img alt="Netlify Deploy"
          src="https://img.shields.io/netlify/63f96f92-e29f-489a-b1e2-f79570c7e323?style=flat-square&logo=netlify"
          style="margin-bottom: 0;margin-right: 0.25rem">
      </a>
      与
      <a href="https://cd-vercel.griseo.top" class="underline flex">
        <img alt="Vercel Deploy" src="https://deploy-badge.vercel.app/vercel/collection-down?style=flat-square"
          style="margin-bottom: 0;margin-right: 0.25rem">
      </a>
      以及
      <a href="https://cd-cloudflare.griseo.top" class="underline flex">
        <img alt="Cloudflare Deploy"
          src="https://deploy-badge.vercel.app/?url=http%3A%2F%2Fcd-cloudflare.griseo.top&style=flat-square&logo=cloudflare&name=Cloudflare"
          style="margin-bottom: 0;margin-right: 0.25rem">
      </a>
    </p>
  </div>
</template>