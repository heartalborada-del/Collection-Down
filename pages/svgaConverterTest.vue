<script lang="ts" setup>
import {Parser} from 'svga';
import {SVGAConverter} from "~/util/svgaConverter";

var i = 0

async function a() {
  const parser = new Parser({
    isDisableWebWorker: true,
  })
  const s = await parser.load("./ts/i0/bfs/garb/item/3db00641061423a764bb04658c4dc653da3155f4.bin")
  const b = new SVGAConverter(s)
  await b.load()
  let blob = b.convertToAPNG()
  b.destruct()
  const fileName = `${new Date().valueOf()}.apng`;
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  window.URL.revokeObjectURL(link.href);
}

</script>

<template>
  <button @click="a()">aaa</button>
</template>

<style lang="scss" scoped>

</style>