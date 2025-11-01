<script setup lang="ts">
import {ParsedType} from "~/utils/parser";
import type {SelectItem} from "#ui/components/Select.vue";

const route = useRoute()
const router = useRouter();

const ParsedResult: Ref<{ type: ParsedType; id: string }> = ref({ type: ParsedType.NONE, id: '' })

const selectItem = ref<SelectItem[]>([
  {
    label: '无',
    id: ParsedType.NONE,
  },
  {
    label: '收藏集',
    id: ParsedType.DLC,
  },
  {
    label: '主题',
    id: ParsedType.THEME,
  }
])

if (route.query) {
  if (route.query.type && typeof route.query.type === 'string') {
    const typeNum = parseInt(route.query.type)
    if (!isNaN(typeNum) && Object.values(ParsedType).includes(typeNum)) {
      ParsedResult.value.type = typeNum as ParsedType
    }
  }
  if (route.query.id && typeof route.query.id === 'string') {
    ParsedResult.value.id = route.query.id
  }
}

watch(ParsedResult, (newVal) => {
  {
    const query: Record<string, string> = {}
    if (newVal.type !== ParsedType.NONE) {
      query.type = newVal.type.toString()
    }
    if (newVal.id.trim() !== '') {
      query.id = newVal.id.trim()
    }
    router.replace({path: '/detail', query})
  }

}, { deep: true, immediate: true })
</script>

<template>
  <div class="flex justify-center-safe">
    <USelect v-model="ParsedResult.type" icon="i-material-symbols-category" class="w-32" value-key="id" :items="selectItem" />
    <UInput v-model="ParsedResult.id" icon="i-mdi-identifier" class="w-64 ml-4 mr-4" placeholder="id" />
  </div>
</template>

<style scoped>

</style>