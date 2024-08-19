<script setup lang="ts">
const props = defineProps<{
  imageUrl: string,
  kv: Map<string,string>,
  onClick: () => void,
}>();
</script>
<style lang="scss">
mdui-card.info {
  transition: width 0.2s ease-in-out;
  width: 100%;
  min-height: 14rem;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin: 0.5rem !important;
  > .image {
    max-width: 8rem;
    min-width: 100px;
    margin: 1rem 1rem;
    box-shadow: var(--mdui-elevation-level5);
    > img {
      object-fit: contain;
      margin: 0;
      display: block;
      width: 100%;
      height: 100%
    }
  }
  > .data {
    display: grid;
    grid-template-columns: auto auto;
    align-items: center;
    gap: .1rem .5rem;
    .key, .value {
      min-width: 4rem;
      display: block;
      white-space: normal;
      word-wrap: break-word;
    }
    .value {
    }
  }
}

@media (min-width: 1080px) {
  mdui-card.info {
    width: 45%;
  }
}

@media (min-width: 1440px) {
  mdui-card.info {
    width: 30%;
  }
}

@media (min-width: 2000px) {
  mdui-card.info {
    width: 500px
  }
}
</style>
<template>
  <mdui-card class="info" @click="props.onClick" clickable>
    <mdui-card class="image" variant="filled" v-if="props.imageUrl !== ''">
      <img :src="props.imageUrl" alt="card">
    </mdui-card>
    <div class="data">
      <template v-for="[key, value] of props.kv.entries()">
        <label class="key">{{ key }}</label>
        <label class="value">{{ value }}</label>
      </template>
    </div>
  </mdui-card>
</template>