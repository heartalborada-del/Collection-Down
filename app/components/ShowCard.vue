<script setup lang="ts">
import type {CardInfo, EmojiInfo} from "~~/types/api/inner/types";

const props = defineProps<{
  url: CardInfo | EmojiInfo | string;
}>();

const showUrl = computed((): string => {
  if (typeof props.url === "string") {
    return props.url;
  } else {
    if ('img' in props.url) {
      return props.url.img as string;
    } else if ('images' in props.url) {
      return props.url.images.static
    } else {
      return ''
    }
  }
})

const name = computed((): string => {
  if (typeof props.url === "string") {
    return ''
  } else {
    return props.url.name
  }
})

const id = Math.random().toString(36).substring(2, 15);
</script>

<template>
  <UCard class="flex justify-center-safe show-card" variant="outline_nopadding">
  <img :key="id" loading="eager" :src="`/api/bili/proxy?origin=${encodeURIComponent(showUrl + '@100w')}`" :alt="name" class="object-cover h-full">
  </UCard>
</template>

<style scoped>

</style>