<script setup lang="ts">
const props = defineProps<{
  imageURL: string,
  name: string,
  type: string,
  onClick: () => void,
}>();
</script>

<template>
  <mdui-card @click="onClick">
    <img src="{{imageURL}}" loading="lazy" alt="data">
    <label>{{name}}</label>
    <label>{{type}}</label>
  </mdui-card>
</template>

<style scoped lang="scss">
mdui-card.result {
  transition:
      width 0.1s ease-in-out,
      border ease-in-out 0.1s,
      border-color ease-in-out 0.1s;
  border: 0;
  margin: 0.5rem;
  width: 140px;
  max-height: 480px;
}

mdui-card.result > img{
  margin: 0;
  display: block;
  width: 100%;
  height: 100%
}

mdui-card.result > .data {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-flow: column;
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  background-color: rgba(101, 101, 101, 0.6);
  opacity: 0;
  transition: all 0.5s;
}

mdui-card.result > .data > label {
  user-select: none;
  -webkit-user-select: none;
  text-align: center;
}

mdui-card.result[hover]{
  /*width: 200px;*/
}

mdui-card.result[hover] > .data {
  opacity: 1;
}

mdui-card.result[pressed] > .data {
  opacity: 1;
}

mdui-card.result[focused] {
  border: 0.15rem solid #2196f3;
}
</style>