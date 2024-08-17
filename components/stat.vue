<script setup lang="ts">

</script>

<template>
  <div class="stat-card error">
    <div class="message">awa</div>
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
      --shape-corner: var(--mdui-shape-corner-extra-small);
      --z-index: 2400;
      position: fixed;
      z-index: var(--z-index);
      align-items: center;
      flex-wrap: wrap;
      border-radius: var(--shape-corner);
      min-width: 20rem;
      max-width: 36rem;
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
  }
</style>