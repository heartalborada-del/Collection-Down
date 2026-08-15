<script setup lang="ts">
import { CardInfo, EmojiInfo, LoadingInfo, OtherInfo, PlayiconInfo, ThumbupInfo, type PackageDataType } from "~~/types/api/inner/types";

const props = defineProps<{
  url: PackageDataType;
  highlight?: boolean;
  previewDisabled?: boolean;
  animatedPreview?: boolean;
}>();

const emit = defineEmits<{
  (e: 'click', payload?: MouseEvent | KeyboardEvent): void;
}>();

const previewOpen = ref(false)

function openHoverPreview(event: PointerEvent) {
  if (event.pointerType === 'mouse' && !props.previewDisabled) {
    previewOpen.value = true
  }
}

function closeHoverPreview(event: PointerEvent) {
  if (event.pointerType === 'mouse') {
    previewOpen.value = false
  }
}

function selectCard(event: MouseEvent | KeyboardEvent) {
  previewOpen.value = false
  emit('click', event)
}

function toggleTouchPreview() {
  previewOpen.value = !previewOpen.value
}

watch(() => props.previewDisabled, (disabled) => {
  if (disabled) {
    previewOpen.value = false
  }
})

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

const previewVideoUrl = computed((): string | undefined => {
  if (!(props.url instanceof CardInfo)) return undefined
  return props.url.video?.find(url => Boolean(url))
    ?? props.url.watermarked?.video?.find(url => Boolean(url))
})

const animatedPreviewAvailable = computed(() => props.animatedPreview && Boolean(previewVideoUrl.value))
const showVideoPreview = computed(() => previewOpen.value && animatedPreviewAvailable.value)

const imageLoaded = ref(false)
const videoLoaded = ref(false)

watch(showUrl, () => {
  imageLoaded.value = false
})

watch([previewOpen, previewVideoUrl], () => {
  videoLoaded.value = false
})
</script>

<template>
  <UPopover
    v-model:open="previewOpen"
    :content="{ side: 'top', sideOffset: 10, collisionPadding: 12 }"
    :ui="{ content: 'p-2' }"
  >
    <template #anchor>
      <div
        class="show-card-anchor"
        @pointerenter="openHoverPreview"
        @pointerleave="closeHoverPreview"
      >
        <UCard
          class="flex justify-center-safe show-card"
          variant="outline_nopadding"
          :class="{ highlight: props.highlight }"
          role="button"
          tabindex="0"
          :aria-label="`${props.highlight ? '取消选择' : '选择'}${name}`"
          :aria-pressed="props.highlight"
          @click="selectCard"
          @keydown.enter.prevent="selectCard"
          @keydown.space.prevent="selectCard"
        >
          <div v-if="!imageLoaded" class="absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <UIcon name="i-mdi-loading" class="size-5 animate-spin text-muted" />
          </div>
          <img
            loading="lazy"
            decoding="async"
            :src="`/api/bili/proxy?origin=${encodeURIComponent(showUrl + '@100w')}`"
            :alt="name"
            class="object-cover h-full"
            draggable="false"
            @load="imageLoaded = true"
            @error="imageLoaded = true"
          >
          <span
            v-if="previewVideoUrl"
            class="animated-card-indicator"
            :class="{ active: props.animatedPreview }"
            title="动态卡片"
          >
            <UIcon name="i-mdi-play" />
          </span>
        </UCard>
        <button
          type="button"
          class="touch-preview-button"
          :aria-label="`${animatedPreviewAvailable ? '播放' : '预览'}${name}`"
          :title="animatedPreviewAvailable ? '动态预览' : '预览'"
          @click.stop="toggleTouchPreview"
        >
          <UIcon
            :name="animatedPreviewAvailable ? 'i-mdi-play-circle-outline' : 'i-mdi-magnify-plus'"
            class="touch-preview-icon"
          />
        </button>
      </div>
    </template>

    <template #content>
      <div class="preview-media-frame" :class="{ video: showVideoPreview }">
        <div
          v-if="showVideoPreview && !videoLoaded"
          class="preview-loading"
          aria-hidden="true"
        >
          <UIcon name="i-mdi-loading" class="size-6 animate-spin text-muted" />
        </div>
        <video
          v-if="showVideoPreview"
          :src="`/api/bili/proxy?origin=${encodeURIComponent(previewVideoUrl!)}`"
          :poster="`/api/bili/proxy?origin=${encodeURIComponent(showUrl)}`"
          :aria-label="`${name}动态预览`"
          class="preview-media"
          autoplay
          muted
          loop
          playsinline
          preload="metadata"
          @canplay="videoLoaded = true"
          @error="videoLoaded = true"
        />
        <img
          v-else
          :src="`/api/bili/proxy?origin=${encodeURIComponent(showUrl)}`"
          :alt="`${name}预览`"
          class="preview-media"
          draggable="false"
        >
      </div>
    </template>
  </UPopover>
</template>

<style scoped>
.show-card-anchor {
  position: relative;
  width: 100px;
  min-height: 100px;
}

.show-card {
  cursor: pointer;
  box-sizing: border-box;
  width: 100%;
  min-height: 100px;
  position: relative;
}

.show-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 0 0 2px var(--ui-color-secondary-500);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.1s ease-in-out;
  z-index: 2;
}

.show-card:focus-visible {
  outline: 2px solid var(--ui-color-primary-500);
  outline-offset: 2px;
}

.show-card.highlight::after {
  opacity: 1;
}

.animated-card-indicator {
  position: absolute;
  right: 6px;
  bottom: 6px;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: rgb(0 0 0 / 58%);
  color: white;
  pointer-events: none;
  z-index: 3;
}

.animated-card-indicator.active {
  background: var(--ui-color-primary-500);
}

.touch-preview-button {
  position: absolute;
  top: 6px;
  right: 6px;
  display: none;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--ui-border-accented) 38%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--ui-bg) 22%, transparent);
  color: var(--ui-text-highlighted);
  box-shadow: 0 2px 8px rgb(0 0 0 / 10%);
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
  appearance: none;
  cursor: pointer;
  line-height: 0;
  z-index: 1;
}

.touch-preview-button:active {
  transform: scale(0.96);
}

.touch-preview-button:focus-visible {
  outline: 2px solid var(--ui-color-primary-500);
  outline-offset: 2px;
}

.touch-preview-icon {
  display: block;
  width: 24px;
  height: 24px;
  flex: none;
}

.preview-media-frame {
  position: relative;
  display: grid;
  place-items: center;
}

.preview-media-frame.video {
  min-width: min(70vw, 14rem);
  min-height: min(50vh, 18rem);
}

.preview-loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  z-index: 1;
}

.preview-media {
  display: block;
  width: auto;
  height: auto;
  max-width: min(80vw, 24rem);
  max-height: min(70vh, 30rem);
  object-fit: contain;
}

@media (max-width: 1023px), (hover: none), (any-pointer: coarse) {
  .touch-preview-button {
    display: grid;
  }
}
</style>
