<script setup lang="ts">
import { CardInfo, EmojiInfo, LoadingInfo, OtherInfo, ThumbupInfo, type PackageDataType } from "~~/types/api/inner/types";

const props = defineProps<{
  url: PackageDataType;
  highlight?: boolean;
}>();

const emit = defineEmits<{
  (e: 'click', payload?: MouseEvent | unknown): void;
}>();

const showUrl = computed((): string => {
  if (props.url instanceof CardInfo) {
    return props.url.img!;
  } else if (props.url instanceof OtherInfo) {
    return props.url.img;
  } else if (props.url instanceof EmojiInfo) {
    if (props.url.images.webp) {
      return props.url.images.webp;
    }
    return props.url.images.static;
  } else if (props.url instanceof LoadingInfo) {
    return props.url.animated;
  } else if (props.url instanceof ThumbupInfo) {
    return props.url.preview;
  } else {
    return '';
  }
})

const name = computed((): string => {
  return props.url.name
})

const id = Math.random().toString(36).substring(2, 15);
</script>

<template>
  <UCard class="flex justify-center-safe show-card" variant="outline_nopadding" :class="{ highlight: props.highlight }">
    <img :key="id" loading="eager" :src="`/api/bili/proxy?origin=${encodeURIComponent(showUrl + '@100w')}`" :alt="name"
      class="object-cover h-full" @click="emit('click', $event)" draggable="false" />
  </UCard>
</template>

<style scoped></style>

<style scoped>
.show-card {
  transition: border 0.1s ease-in-out;
  cursor: pointer;
  box-sizing: border-box;
  width: 100px;
}

.show-card.highlight {
  border: 2px solid var(--ui-color-secondary-500);
}
</style>