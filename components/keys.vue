<script setup lang="ts">
const props = defineProps<{
  keys: string
}>();
</script>

<template>
  <strong>{{ props.keys.replaceAll(/{[a-zA-Z]+}/g, "") }}</strong>
  <template v-if="props.keys.includes('{COLLECTION}')">&nbsp;-&nbsp;收藏集</template>
  <template v-else-if="props.keys.includes('{STICKER}')">&nbsp;-&nbsp;表情包</template>
  <template v-else-if="props.keys.includes('{THEME}')">&nbsp;-&nbsp;主题图片</template>
  <template v-else-if="props.keys.includes('{OTHER}')">&nbsp;-&nbsp;其他</template>
  <template v-else-if="props.keys.includes('{BACKGROUND}')">&nbsp;-&nbsp;背景</template>
</template>

<style scoped lang="scss">

</style>