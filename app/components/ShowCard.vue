<script setup lang="ts">
import { CardInfo, EmojiInfo, LoadingInfo, OtherInfo, PlayiconInfo, ThumbupInfo, type PackageDataType } from "~~/types/api/inner/types";

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
  } else if (props.url instanceof PlayiconInfo) {
    return props.url.icon.preview;
  } else {
    return '';
  }
})

const name = computed((): string => {
  return props.url.name
})

const imageLoaded = ref(false)

watch(showUrl, () => {
  imageLoaded.value = false
})
</script>

<template>
  <UCard class="flex justify-center-safe show-card" variant="outline_nopadding" :class="{ highlight: props.highlight }">
    <div v-if="!imageLoaded" class="absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <UIcon name="i-mdi-loading" class="size-5 animate-spin text-muted" />
    </div>
    <img
loading="lazy" decoding="async" :src="`/api/bili/proxy?origin=${encodeURIComponent(showUrl + '@100w')}`"
      :alt="name" class="object-cover h-full" draggable="false" @load="imageLoaded = true"
      @error="imageLoaded = true" @click="emit('click', $event)">
  </UCard>
</template>

<style scoped></style>

<style scoped>
.show-card {
  transition: border 0.1s ease-in-out;
  cursor: pointer;
  box-sizing: border-box;
  width: 100px;
  min-height: 100px;
  position: relative;
}

.show-card.highlight {
  border: 2px solid var(--ui-color-secondary-500);
}
</style>
