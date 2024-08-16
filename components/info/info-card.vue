<script setup lang="ts">
const props = defineProps<{
  imageURL: string,
  kv: Map<string,string>,
}>();
</script>
<style lang="scss">
mdui-card.info {
  display: flex;
  > .image {
    width: 40%;
    max-width: 200px;
    margin: 0 2.5rem;
  }
  > .data {
    display: flex;
    flex-direction: row;
    align-items: center;
    > .key, > .value {
      display: flex;
      flex-direction: column;
    }
    > .key {
      margin-right: 0.25rem;
    }
    > .value {
      margin-left: 0.25rem;
    }
  }
}
</style>
<template>
  <mdui-card class="info">
    <mdui-card class="image">
      <img :src="props.imageURL">
    </mdui-card>
    <div class="data">
      <div class="key">
        <label v-for="value in props.kv.keys()">{{ value }}</label>
      </div>
      <div class="value">
        <label v-for="value in props.kv.values()">{{ value }}</label>
      </div>
    </div>
  </mdui-card>
</template>