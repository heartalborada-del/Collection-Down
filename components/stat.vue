<script setup lang="ts">
const props = defineProps<{
  classes: string[],
  message: string
}>();
</script>

<template>
  <div class="stat-card" :class="props.classes">
    <div class="message">{{ props.message }}</div>
  </div>
</template>

<style scoped lang="scss">
  .stat-card {
    > .message {
      display: block;
      margin: 0.625rem 1rem;
      text-align: center;
    }
    & {
      transition: background-color 0.5s ease-in,
                  color 0.5s ease-in,
                  opacity 2s ease-in;
      align-items: center;
      flex-wrap: wrap;
      border-radius: var(--mdui-shape-corner-extra-small);
      min-width: 20rem;
      padding: 0.25rem 0;
      box-shadow: var(--mdui-elevation-level3);
      background-color: rgb(var(--mdui-color-inverse-surface));
      color: rgb(var(--mdui-color-inverse-on-surface));
      font-size: var(--mdui-typescale-body-medium-size);
      font-weight: var(--mdui-typescale-body-medium-weight);
      letter-spacing: var(--mdui-typescale-body-medium-tracking);
      line-height: var(--mdui-typescale-body-medium-line-height);
    }
  }
  .stat-card.error {
    color: rgb(var(--mdui-color-on-error));
    background-color: rgb(var(--mdui-color-error));
    opacity: 1;
  }
  .stat-card.success {
    color: #FFFFFF;
    background-color: #005F01;
    opacity: 0;
  }
</style>