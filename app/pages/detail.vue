<script setup lang="ts">
import { ParsedType } from "~/utils/Preprocess";
import { type DetailedData, CardInfo, DownloadMetaData, EmojiInfo, LoadingInfo, OtherInfo, ThumbupInfo, type PackageDataType, PlayiconInfo } from "~~/types/api/inner/types";
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
const selectedSets = ref<Map<DetailedData, Set<string>>>(new Map())

const checked = ref<boolean | 'indeterminate'>(false);
const hasValidId = (id?: number) => Number.isFinite(id) && (id as number) > 0
const getSafeName = (name?: string) => {
  const trimmed = (name ?? '').trim()
  return trimmed.length > 0 ? trimmed : 'unknown'
}

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
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      try { EnableTrace && umTrackEvent('detail', { type: 'DLC', id: ParsedResult.value.id }) } catch { /* empty */ }
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
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      try { EnableTrace && umTrackEvent('detail', { type: 'THEME', id: ParsedResult.value.id }) } catch { /* empty */ }
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

function getCardSelectKey(item: PackageDataType): string {
  if (item instanceof CardInfo) {
    return hasValidId(item.id) ? `card:${item.id}` : `card:name:${getSafeName(item.name)}`
  }
  if (item instanceof EmojiInfo) {
    return hasValidId(item.item_id) ? `emoji:${item.item_id}` : `emoji:name:${getSafeName(item.name)}`
  }
  if (item instanceof OtherInfo) {
    return hasValidId(item.id) ? `other:${item.id}` : `other:name:${getSafeName(item.name)}`
  }
  if (item instanceof PlayiconInfo) {
    return hasValidId(item.id) ? `playicon:${item.id}` : `playicon:name:${getSafeName(item.name)}`
  }
  if (item instanceof LoadingInfo) {
    return `loading:name:${getSafeName(item.name)}`
  }
  if (item instanceof ThumbupInfo) {
    return `thumbup:name:${getSafeName(item.name)}`
  }
  return `unknown:name:${getSafeName(item.name)}`
}

function buildCardKeyMap(pkg: DetailedData): Map<string, PackageDataType> {
  const map = new Map<string, PackageDataType>()
  for (const card of pkg.data) {
    map.set(getCardSelectKey(card), card)
  }
  return map
}

function queryCardIsSelected(card: PackageDataType, pkg: DetailedData): boolean {
  const cardMap = selectedSets.value.get(pkg)
  if (cardMap?.has(getCardSelectKey(card))) {
    return true
  }
  return false
}

function removeCardByKey(cardKey: string, pkg: DetailedData) {
  const cardMap = selectedSets.value.get(pkg)
  if (cardMap?.has(cardKey)) {
    cardMap?.delete(cardKey)
  }
  refreshSelectedCards();
}

function setActiveCard(currentCard: PackageDataType, pkg: DetailedData | undefined) {
  if (currentPackage.value.id === 0 || !pkg) {
    return
  }
  if (currentCard instanceof CardInfo || currentCard instanceof OtherInfo || currentCard instanceof EmojiInfo || currentCard instanceof LoadingInfo || currentCard instanceof ThumbupInfo || currentCard instanceof PlayiconInfo) {
    if (!selectedSets.value.has(pkg)) {
      selectedSets.value.set(pkg, new Set())
    }
    const cardMap = selectedSets.value.get(pkg)
    const cardKey = getCardSelectKey(currentCard)
    if (cardMap?.has(cardKey)) {
      cardMap?.delete(cardKey)
    } else {
      cardMap?.add(cardKey)
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
      newSet.add(getCardSelectKey(card))
    })
    selectedSets.value.set(currentPackage.value, newSet)
  } else {
    selectedSets.value.set(currentPackage.value, new Set())
  }
}

function refreshSelectedCards() {
  if (currentPackage.value.id === 0) {
    return
  }
  const cardMap = selectedSets.value.get(currentPackage.value)
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
  for (const [pkg, cardSet] of selectedSets.value) {
    const packageItem: TreeItem = {
      label: pkg.name,
      children: []
    }
    if (cardSet.size === 0) {
      continue
    }
    if (pkg.type === PackageType.Card) {
      treeData[0].children!.push(packageItem)
    } else if (pkg.type === PackageType.Theme) {
      treeData[1].children!.push(packageItem)
    } else if (pkg.type === PackageType.Sticker) {
      treeData[2].children!.push(packageItem)
    } else if (pkg.type === PackageType.Other) {
      treeData[3].children!.push(packageItem)
    }
    const cardKeyMap = buildCardKeyMap(pkg)
    cardSet.forEach(cardKey => {
      const target = cardKeyMap.get(cardKey)
      packageItem.children!.push({
        label: target?.name ?? 'Unknown Item',
        slot: 'checkable' as const,
        package: pkg.id,
        cardKey: cardKey,
        packageRef: pkg
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
  for (const [pkg, set] of selectedSets.value) {
    const a = pkg.name!.split('-')
    const path = `${a[0]}/${a.slice(1).join('-')}`
    const cardKeyMap = buildCardKeyMap(pkg)
    for (const cardKey of set) {
      const target = cardKeyMap.get(cardKey)
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
        if (target.watermarked) {
          if (target.watermarked.img) {
            files.push(new DownloadMetaData({
              url: target.watermarked.img!,
              type: ItemType.StaticCardWatermarked,
              filename: `${path}/static_watermarked/${target.name}.${GetFileExtensionFromUrl(target.watermarked.img)}`,
              name: target.name
            }))
          }
          if (target.watermarked.video) {
            files.push(new DownloadMetaData({
              url: target.watermarked.video![0]!,
              type: ItemType.AnimatedCardWatermarked,
              filename: `${path}/video_watermarked/${target.name}.${GetFileExtensionFromUrl(target.watermarked.video![0]!)}`,
              name: target.name
            }))
          }
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
          filename: `${path}/thumbup/${target.name}.png`,
          type: ItemType.SVGA,
          name: target.name
        }))
        continue
      } else if (target instanceof PlayiconInfo) {
        if (target.isLottie) {
          const  icon = target.icon as PlayiconInfo.LottieIcon
          files.push(new DownloadMetaData({
            url: icon.drag,
            filename: `${path}/playicon/drag.json`,
            type: ItemType.PlayIconLottie,
            name: target.name
          }))
          files.push(new DownloadMetaData({
            url: icon.normal!,
            filename: `${path}/playicon/normal.json`,
            type: ItemType.PlayIconLottie,
            name: target.name
          }))
        } else {
          const icon = target.icon as PlayiconInfo.StaticIcon
          files.push(new DownloadMetaData({
            url: icon.dragLeft!,
            filename: `${path}/playicon/drag_left.png`,
            type: ItemType.PlayIconStatic,
            name: target.name
          }))
          files.push(new DownloadMetaData({
            url: icon.normal!,
            filename: `${path}/playicon/normal.png`,
            type: ItemType.PlayIconStatic,
            name: target.name
          }))
          files.push(new DownloadMetaData({
            url: icon.dragRight!,
            filename: `${path}/playicon/drag_right.png`,
            type: ItemType.PlayIconStatic,
            name: target.name
          }) )
        }
        files.push(new DownloadMetaData({
          url: target.icon.preview!,
          filename: `${path}/playicon/preview.${GetFileExtensionFromUrl(target.icon.preview!)}`,
          type: ItemType.PlayIconPreview,
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
            @click="setActiveCard(object, currentPackage)"
            :highlight="queryCardIsSelected(object, currentPackage)">
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
              let data = (item as { package: number, packageRef: DetailedData, label: string, cardKey: string })
              removeCardByKey(data.cardKey, data.packageRef);
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
