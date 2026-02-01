<script setup lang="ts">
import { ParsedType } from "~/utils/Preprocess";
import { CardInfo, DetailedData, DownloadMetaData, EmojiInfo, LoadingInfo, OtherInfo, ThumbupInfo, type PackageDataType } from "~~/types/api/inner/types";
import { ItemType, PackageType } from "~~/types/api/enum";
import type { TreeItem } from "@nuxt/ui";
import type { TreeItemSelectEvent } from 'reka-ui'
import { MD5 } from "object-hash"

const route = useRoute()
const router = useRouter();
const toast = useToast()

const ParsedResult: Ref<{ type: ParsedType; id: string }> = ref({ type: ParsedType.NONE, id: '' })

const ItemsArray = ref<DetailedData[]>([])

const selectItem = ref<{
  label: string;
  id: ParsedType;
}[]>([
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

// 简化并发控制，使用布尔锁防止重复请求
const fetching = ref(false)

const currentPackage = ref<DetailedData>({
  id: 0,
  type: PackageType.Undefined,
  data: []
})
const selectedSets = ref<Map<string, Set<string>>>(new Map())

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
  if (fetching.value) return
  fetching.value = true
  const { public: { EnableTrace } } = useRuntimeConfig()
  if (ParsedResult.value.type === ParsedType.DLC) {
    ItemsArray.value = []
    currentPackage.value = {
      id: 0,
      type: PackageType.Undefined,
      data: []
    }
    selectedSets.value = new Map()
    try {
      try { EnableTrace && umTrackEvent('detail', { type: 'DLC', id: ParsedResult.value.id }) } catch { }
      const collections = await GetCollectionMigratedData(Number(ParsedResult.value.id))
      for (const collection of collections) {
        if (collection.type === PackageType.Undefined) {
          continue
        }
        const cp = collection
        switch (collection.type) {
          case PackageType.Card:
            cp.name = `收藏集-${collection.name}`
            break
          case PackageType.Theme:
            cp.name = `主题-${collection.name}`
            break
          case PackageType.Sticker:
            cp.name = `表情包-${collection.name}`
            break
          case PackageType.Other:
            cp.name = `杂项-${collection.name}`
        }
        ItemsArray.value.push(cp)
      }
    } catch {
      toast.add({
        title: `获取 收藏集ID ${ParsedResult.value.id} 失败`,
        description: `请检查ID是否正确或稍后重试`,
        icon: 'i-mdi-alert-circle',
        color: 'error'
      })
      return
    }
    toast.add({
      title: `获取 卡池ID ${ParsedResult.value.id} 成功`,
      description: `获得 ${ItemsArray.value.length} 个收藏集及其附属数据`,
      icon: 'i-mdi-check-circle',
      color: 'success'
    })
  } else if (ParsedResult.value.type === ParsedType.THEME) {
    ItemsArray.value = []
    currentPackage.value = {
      id: 0,
      type: PackageType.Undefined,
      data: []
    }
    selectedSets.value = new Map()
    try {
      try { EnableTrace && umTrackEvent('detail', { type: 'THEME', id: ParsedResult.value.id }) } catch { }
      const themeData = await GetSuitDetails(Number(ParsedResult.value.id))
      for (const data of themeData) {
        if (data.type === PackageType.Undefined) {
          continue
        }
        const cp = data
        switch (data.type) {
          case PackageType.Card:
            cp.name = `收藏集-${data.name}`
            break
          case PackageType.Theme:
            cp.name = `主题-${data.name}`
            break
          case PackageType.Sticker:
            cp.name = `表情包-${data.name}`
            break
          case PackageType.Other:
            cp.name = `杂项-${data.name}`
        }
        ItemsArray.value.push(cp)
      }
    } catch {
      toast.add({
        title: `获取 收藏集ID ${ParsedResult.value.id} 失败`,
        description: `请检查ID是否正确或稍后重试`,
        icon: 'i-mdi-alert-circle',
        color: 'error'
      })
      return
    }
    toast.add({
      title: `获取 主题ID ${ParsedResult.value.id} 成功`,
      description: `获得 ${ItemsArray.value.length} 个主题数据`,
      icon: 'i-mdi-check-circle',
      color: 'success'
    })
  }
  fetching.value = false
}

function queryCardIsSelected(cardName: string, packageName: string): boolean {
  const cardMap = selectedSets.value.get(packageName)
  if (cardMap?.has(cardName)) {
    return true
  }
  return false
}

function removeCardByName(cardName: string, packageName: string) {
  const cardMap = selectedSets.value.get(packageName)
  if (cardMap?.has(cardName)) {
    cardMap?.delete(cardName)
  }
  refreshSelectedCards();
}

function setActiveCard(currentCard: PackageDataType, packageName: string | undefined) {
  if (currentPackage.value.id === 0 || !packageName) {
    return
  }
  if (currentCard instanceof CardInfo || currentCard instanceof OtherInfo || currentCard instanceof EmojiInfo || currentCard instanceof LoadingInfo || currentCard instanceof ThumbupInfo) {
    if (!selectedSets.value.has(packageName)) {
      selectedSets.value.set(packageName, new Set())
    }
    const cardMap = selectedSets.value.get(packageName)
    if (cardMap?.has(currentCard.name) && cardMap?.has(currentCard.name)) {
      cardMap?.delete(currentCard.name)
    } else {
      cardMap?.add(currentCard.name)
    }
  }
  refreshSelectedCards()
}

function toggleSelectAllCards() {
  if (currentPackage.value.id === 0) {
    return
  }
  if (checked.value === true) {
    const newSet = new Set<string>()
    currentPackage.value.data.forEach((card) => {
      card = card as CardInfo
      newSet.add(card.name)
    })
    selectedSets.value.set(currentPackage.value.name!, newSet)
  } else {
    selectedSets.value.set(currentPackage.value.name!, new Set())
  }
}

function refreshSelectedCards() {
  if (currentPackage.value.id === 0) {
    return
  }
  const cardMap = selectedSets.value.get(currentPackage.value.name!)
  if (cardMap?.size === currentPackage.value.data.length) {
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
watch(selectedSets, () => {
  const treeData: TreeItem[3] = [
    { label: '收藏集', children: [] },
    { label: '主题', children: [] },
    { label: '表情包', children: [] },
    { label: '杂项', children: [] }
  ]
  for (const [packageName, cardSet] of selectedSets.value) {
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
    } else if (targetPackage?.type === PackageType.Other) {
      treeData[3].children!.push(packageItem)
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
  downloadFiles.value = getSelectedDownloadFiles()
  if (downloadFiles.value.length === 0) {
    toast.add({
      title: '未选择任何文件',
      description: '请至少选择一个文件进行下载',
      icon: 'i-mdi-alert-circle',
      color: 'warning'
    })
    return
  }
  downloadPanelOpen.value = true
}

function getSelectedDownloadFiles(): Array<DownloadMetaData> {
  const files: DownloadMetaData[] = []
  for (const [packageName, set] of selectedSets.value) {
    const targetPackage = ItemsArray.value.find(item => item.name === packageName)
    let a = packageName.split('-')
    const path = `${a[0]}/${a[1]}`
    if (!targetPackage) {
      continue
    }
    for (const name of set) {
      const target = targetPackage.data.find(card => card.name === name)
      if (!target) {
        continue
      }
      if (target instanceof CardInfo) {
        files.push(new DownloadMetaData({
          url: target.img!,
          type: ItemType.StaticCard,
          filename: `${path}/static/${target.name}.${GetFileExtensionFromUrl(target.img!)}`,
          name: target.name
        }))
        if (target.video) {
          files.push(new DownloadMetaData({
            url: target.video![0]!,
            type: ItemType.AnimatedCard,
            filename: `${path}/video/${target.name}.${GetFileExtensionFromUrl(target.video![0]!)}`,
            name: target.name
          }))
        }
        continue
      } else if (target instanceof EmojiInfo) {
        files.push(new DownloadMetaData({
          url: target.images.static!,
          type: ItemType.StaticSticker,
          filename: `${path}/png/${target.name}.${GetFileExtensionFromUrl(target.images.static!)}`,
          name: target.name
        }))
        if (target.images.webp) {
          files.push(new DownloadMetaData({
            url: target.images.webp!,
            type: ItemType.WebpSticker,
            filename: `${path}/webp/${target.name}.${GetFileExtensionFromUrl(target.images.webp!)}`,
            name: target.name
          }))
        }
        if (target.images.gif) {
          files.push(new DownloadMetaData({
            url: target.images.gif!,
            type: ItemType.GifSticker,
            filename: `${path}/gif/${target.name}.${GetFileExtensionFromUrl(target.images.gif!)}`,
            name: target.name
          }))
        }
        continue
      } else if (target instanceof OtherInfo) {
        files.push(new DownloadMetaData({
          url: target.img!,
          filename: `${path}/${target.name}.${GetFileExtensionFromUrl(target.img!)}`,
          type: ItemType.Other,
          name: target.name
        }))
        continue
      } else if (target instanceof LoadingInfo) {
        files.push(new DownloadMetaData({
          url: target.animated!,
          filename: `${path}/loading/${target.name}.${GetFileExtensionFromUrl(target.animated!)}`,
          type: ItemType.WebpSticker,
          name: target.name
        }))
        continue
      } else if (target instanceof ThumbupInfo) {
        files.push(new DownloadMetaData({
          url: target.url!,
          filename: `${path}/thumbup/${target.name}.png}`,
          type: ItemType.SVGA,
          name: target.name
        }))
        continue
      }
    }
  }
  return files
}

const downloadFiles = ref<DownloadMetaData[]>([])
</script>

<template>
  <div>
    <div class="flex justify-center-safe items-center-safe gap-1 min-h-9 flex-wrap">
      <USelect v-model="ParsedResult.type" icon="i-material-symbols-category" class="w-32 max-sm:grow" value-key="id"
        :items="selectItem" />
      <UInput v-model="ParsedResult.id" icon="i-mdi-identifier" class="w-64 max-sm:grow" placeholder="id" />
      <UButton trailing-icon="i-ic-arrow-forward" size="md" variant="outline" color="secondary" @click="fetchData"
        class="w-full sm:w-auto text-nowrap">
        获取数据
      </UButton>
    </div>
    <USeparator class="m-2" size="md" />
    <div class="flex justify-center-safe items-center flex-wrap gap-4 max-sm:gap-1 ">
      <div class="flex justify-center-safe items-center gap-1 grow">
        <USelectMenu v-model="currentPackage" class="min-w-40 grow" label-key="name" :items="ItemsArray as any"
          @change="refreshSelectedCards" />
        <UCheckbox v-model="checked" :disabled="currentPackage.id === 0" label="全选" class="justify-center text-nowrap"
          size="lg" @change="toggleSelectAllCards" />
      </div>
      <UButton class="max-sm:grow text-nowrap" color="primary" variant="outline" icon="i-mdi-download"
        @click="download">下载
      </UButton>
    </div>
    <USeparator class="m-2" size="md" />
    <div v-if="currentPackage.id !== 0" style="display: flex; flex-flow: row;">
      <div class="flex justify-center-safe items-center flex-wrap gap-2 h-full">
        <TransitionGroup name="opacity-card" appear>
          <ShowCard v-for="object in currentPackage.data" :key="MD5(object)" :url="object"
            @click="setActiveCard(object, currentPackage.name)"
            :highlight="queryCardIsSelected(object.name, currentPackage.name!)">
          </ShowCard>
        </TransitionGroup>
      </div>
      <UCard class="hidden lg:block overflow-y-auto ml-auto" style="min-width: 300px; max-height: 500px;"
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
    <DownloadModal :open="downloadPanelOpen" @close="() => { downloadPanelOpen = false }"
      :file-metadatas="downloadFiles" />
  </div>
</template>