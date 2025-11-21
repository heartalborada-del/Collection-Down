<script setup lang="ts">
import {ParsedType} from "~/utils/Preprocess";
import type {SelectItem} from "#ui/components/Select.vue";
import {Mutex} from "mutex-ts";
import type {CardInfo, DetailedData} from "~~/types/api/inner/types";
import {PackageType} from "~~/types/api/enum";
import type {TreeItem} from "@nuxt/ui";
import type {TreeItemSelectEvent} from 'reka-ui'
import {GetCollectionMigratedData} from "~/utils/getCollection";

const route = useRoute()
const router = useRouter();
const toast = useToast()

const ParsedResult: Ref<{ type: ParsedType; id: string }> = ref({ type: ParsedType.NONE, id: '' })

const ItemsArray = ref<DetailedData[]>([])

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

const lock = new Mutex()

const currentCardPackage = ref<DetailedData>({
  id: 0,
  type: PackageType.Undefined,
  data: []
})
const selectedCards = ref<Map<string, Set<string>>>(new Map())

const checked = ref<boolean | 'indeterminate'>(false);

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

watch(ParsedResult, (newVal: { type: ParsedType; id: string }) => {
  {
    const query: Record<string, string> = {}
    if (newVal.type !== ParsedType.NONE) {
      query.type = newVal.type.toString()
    }
    if (newVal.id.trim() !== '') {
      query.id = newVal.id.trim()
    }
    router.replace({ path: '/detail', query })
  }
}, { deep: true, immediate: true })

async function fetchData() {
  if (ParsedResult.value.type !== ParsedType.DLC) {
    return
  }

  ItemsArray.value = []
  currentCardPackage.value = {
    id: 0,
    type: PackageType.Undefined,
    data: []
  }
  selectedCards.value = new Map()
  using _ = await lock.lock();
  ItemsArray.value = await GetCollectionMigratedData(Number(ParsedResult.value.id))
  toast.add({
    title: `获取 卡池ID ${ParsedResult.value.id} 成功`,
    description: `获得 ${ItemsArray.value.length} 个收藏集`,
    icon: 'i-mdi-check-circle',
    color: 'success'
  })
}

function removeCardByName(cardName: string, cardPackageName: string) {
  const cardMap = selectedCards.value.get(cardPackageName)
  if (cardMap?.has(cardName)) {
    cardMap?.delete(cardName)
  }
  refreshSelectedCards()
}

function selectCard(currentCard: CardInfo, cardPackageName: string) {
  if (!selectedCards.value.has(cardPackageName)) {
    selectedCards.value.set(cardPackageName, new Set())
  }
  const cardMap = selectedCards.value.get(cardPackageName)
  if (cardMap?.has(currentCard.name) && cardMap?.has(currentCard.name)) {
    cardMap?.delete(currentCard.name)
  } else {
    cardMap?.add(currentCard.name)
  }
  refreshSelectedCards()
}

function toggleSelectAllCards() {
  if (currentCardPackage.value.id === 0) {
    return
  }
  if (checked.value === true) {
    const newSet = new Set<string>()
    currentCardPackage.value.data.forEach((card: CardInfo) => {
      newSet.add(card.name)
    })
    selectedCards.value.set(currentCardPackage.value.name!, newSet)
  } else {
    selectedCards.value.set(currentCardPackage.value.name!, new Set())
  }
}

function refreshSelectedCards() {
  if (currentCardPackage.value.id === 0) {
    return
  }
  const cardMap = selectedCards.value.get(currentCardPackage.value.name!)
  if (cardMap?.size === currentCardPackage.value.data.length) {
    checked.value = true
  } else {
    if (!cardMap || cardMap?.size === 0) {
      checked.value = false
    } else {
      checked.value = 'indeterminate'
    }
  }
}

const generatedTreeData = ref<TreeItem[]>([])
const treeDataKey = ref<number>(0)
watch(selectedCards, () => {

  const treeData: TreeItem[3] = [
    { label: '收藏集', children: [] },
    { label: '主题', children: [] },
    { label: '表情包', children: [] }
  ]
  for (const [packageName, cardSet] of selectedCards.value) {
    const packageItem: TreeItem = {
      label: packageName,
      children: []
    }
    if (cardSet.size === 0) {
      continue
    }
    const targetPackage = ItemsArray.value.find(item => item.name === packageName)
    if (targetPackage?.type === PackageType.Card) {
      treeData[0].children!.push(packageItem)
    } else if (targetPackage?.type === PackageType.Theme) {
      treeData[1].children!.push(packageItem)
    } else if (targetPackage?.type === PackageType.Sticker) {
      treeData[2].children!.push(packageItem)
    }
    cardSet.forEach(cardName => {
      packageItem.children!.push({
        label: cardName,
        slot: 'checkable' as const,
        package: targetPackage?.id,
        packageName: packageName
      })
    })
  }
  const newtreeData: TreeItem[] = []
  for (const r of treeData) {
    if (r.children!.length !== 0) {
      newtreeData.push(r)
    }
  }
  generatedTreeData.value = newtreeData
  treeDataKey.value = Date.now()
}, { deep: true, immediate: true })

const downloadPanelOpen = ref(false)
function download() {
  downloadPanelOpen.value = true
}
</script>

<template>
  <div>
    <div class="flex justify-center-safe h-9">
      <USelect v-model="ParsedResult.type" icon="i-material-symbols-category" class="w-32" value-key="id"
        :items="selectItem" />
      <UInput v-model="ParsedResult.id" icon="i-mdi-identifier" class="w-64 ml-4 mr-4" placeholder="id" />
      <UButton trailing-icon="i-ic-arrow-forward" size="md" variant="outline" color="secondary" @click="fetchData">
        获取数据
      </UButton>
    </div>
    <USeparator class="m-2" size="md" />
    <div class="flex justify-center-safe items-center">
      <USelectMenu v-model="currentCardPackage" class="w-9/12 min-w-40" label-key="name"
        :items="ItemsArray as SelectItem[]" @change="refreshSelectedCards" />
      <UCheckbox v-model="checked" :disabled="currentCardPackage.id === 0" label="全选" class="justify-center ml-2"
        size="lg" @change="toggleSelectAllCards" />
      <UButton class="ml-4" color="primary" variant="outline" icon="i-mdi-download" @click="download">下载</UButton>
    </div>
    <USeparator class="m-2" size="md" />
    <div v-if="currentCardPackage.id !== 0" style="display: flex; flex-flow: row;">
      <div class="flex justify-center-safe items-center flex-wrap gap-2 h-full">
        <TransitionGroup name="opacity-card" appear>
          <ShowCard v-for="card in currentCardPackage.data" :key="Math.random().toString()" :url="card"></ShowCard>
        </TransitionGroup>
      </div>
      <UCard class="hidden lg:block ml-2 overflow-y-auto" style="min-width: 300px; max-height: 500px;"
        variant="outline_nopadding">
        <UTree :items="generatedTreeData" @select="(e: TreeItemSelectEvent<TreeItem>) => {
          if (e.detail.originalEvent.type === 'click') {
            e.preventDefault()
          }
        }" v-if="generatedTreeData.length !== 0">
          <template #checkable="{ item }">
            <UCheckbox class="w-full text-left" :key="treeDataKey" :model-value="true" @change="() => {
              let data = (item as { package: number, packageName: string, label: string })
              removeCardByName(data.label, data.packageName);
            }" :label="(item as { label: string }).label"></UCheckbox>
          </template>
        </UTree>
        <div v-else>
          <USeparator class="pt-4" label="还没有数据哦" size="lg" />
        </div>
      </UCard>
    </div>
    <USeparator v-else class="pt-4" label="还没有数据哦" size="lg" />
    <DownloadModal :open="downloadPanelOpen" @close="() => { downloadPanelOpen = false }" />
  </div>
</template>

<style scoped>
.show-card {
  transition: border 0.1s ease-in-out;
  cursor: pointer;
}

.show-card.selected {
  border: 2px solid var(--ui-color-secondary-500);
  box-sizing: border-box;
}
</style>