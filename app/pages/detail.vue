<script setup lang="ts">
import { ParsedType } from "~/utils/Preprocess";
import { type DetailedData, CardInfo, DownloadMetaData, EmojiInfo, LoadingInfo, OtherInfo, ThumbupInfo, type PackageDataType, PlayiconInfo } from "~~/types/api/inner/types";
import { ItemType, PackageType } from "~~/types/api/enum";
import type { TreeItem } from "@nuxt/ui";
import type { TreeItemSelectEvent } from 'reka-ui'
import { MD5 } from "object-hash"
import { getErrorMessage } from '~/utils/apiError'

const route = useRoute()
const router = useRouter();
const toast = useToast()
const onboardingSteps = [
  {
    title: '选择资源类型',
    description: '选择要获取的是收藏集还是主题。',
    icon: 'i-material-symbols-category',
    target: '[data-tour="detail-type"]',
  },
  {
    title: '输入资源 ID',
    description: '填写从搜索页得到的 ID，也可以直接手动输入。',
    icon: 'i-mdi-identifier',
    target: '[data-tour="detail-id"]',
  },
  {
    title: '获取资源数据',
    description: '点击后加载收藏集或主题包含的资源包。',
    icon: 'i-mdi-database-search-outline',
    target: '[data-tour="detail-fetch"]',
  },
  {
    title: '选择资源包',
    description: '数据加载完成后，从列表中选择要查看和下载的资源包。',
    icon: 'i-mdi-package-variant-closed',
    target: '[data-tour="detail-package"]',
  },
  {
    title: '全选当前资源包',
    description: '使用全选一次选中或取消当前资源包中的所有项目。',
    icon: 'i-mdi-checkbox-multiple-marked-outline',
    target: '[data-tour="detail-select-all"]',
  },
  {
    title: '逐项选择资源',
    description: '点击卡片切换选中状态，高亮边框表示该项目会被下载。',
    icon: 'i-mdi-cards-outline',
    target: '[data-tour="detail-cards"]',
  },
  {
    title: '检查已选内容',
    description: '桌面端右侧会汇总已选项目，也可以在这里单独取消项目。',
    icon: 'i-mdi-file-tree-outline',
    target: '[data-tour="detail-selection-tree"]',
  },
  {
    title: '设置并开始下载',
    description: '选择至少一个项目后，点击下载打开下载设置。',
    icon: 'i-mdi-download-outline',
    target: '[data-tour="detail-download"]',
  },
]

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

const packageTypeLabels: Partial<Record<PackageType, string>> = {
  [PackageType.Card]: '收藏集',
  [PackageType.Theme]: '主题',
  [PackageType.Sticker]: '表情包',
  [PackageType.Other]: '杂项'
}

function normalizePackages(packages: DetailedData[]): DetailedData[] {
  return packages
    .filter(pkg => pkg.type !== PackageType.Undefined)
    .map(pkg => ({
      ...pkg,
      name: `${packageTypeLabels[pkg.type] ?? '杂项'}-${pkg.name}`
    }))
}

async function fetchData() {
  if (fetching.value) return

  const id = Number(ParsedResult.value.id)
  if (!Number.isSafeInteger(id) || id <= 0 || ParsedResult.value.type === ParsedType.NONE) {
    toast.add({
      title: '请输入有效的正整数 ID 并选择类型',
      icon: 'i-mdi-alert-circle',
      color: 'warning'
    })
    return
  }

  fetching.value = true
  const isCollection = ParsedResult.value.type === ParsedType.DLC
  const typeLabel = isCollection ? '收藏集' : '主题'
  const warnings: string[] = []
  const { public: { EnableTrace } } = useRuntimeConfig()
  try {
    try { if (EnableTrace) umTrackEvent('detail', { type: isCollection ? 'DLC' : 'THEME', id: String(id) }) } catch { /* empty */ }
    const packages = isCollection
      ? await GetCollectionMigratedData(id, message => warnings.push(message))
      : await GetSuitDetails(id, message => warnings.push(message))

    ItemsArray.value = normalizePackages(packages)
    currentPackage.value = { id: 0, type: PackageType.Undefined, data: [] }
    selectedSets.value = new Map()
    checked.value = false
    if (warnings.length > 0) {
      toast.add({
        title: `获取 ${typeLabel}ID ${id} 基本成功`,
        description: warnings.join('；'),
        icon: 'i-mdi-alert-circle',
        color: 'warning'
      })
    } else {
      toast.add({
        title: `获取 ${typeLabel}ID ${id} 成功`,
        description: `获得 ${ItemsArray.value.length} 个${typeLabel}及其附属数据`,
        icon: 'i-mdi-check-circle',
        color: 'success'
      })
    }
  } catch (error) {
    console.error(`Failed to fetch ${typeLabel} ${id}:`, error)
    toast.add({
      title: `获取 ${typeLabel}ID ${id} 失败`,
      description: getErrorMessage(error, '请检查 ID 是否正确或稍后重试'),
      icon: 'i-mdi-alert-circle',
      color: 'error'
    })
  } finally {
    fetching.value = false
  }
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
  const filenameCountMap = new Map<string, number>()
  const getNameIdPrefix = (item: PackageDataType): string => {
    const name = getSafeName(item.name)
    if (item instanceof CardInfo) {
      return `${name}-${hasValidId(item.id) ? item.id : 0}`
    }
    if (item instanceof EmojiInfo) {
      return `${name}-${hasValidId(item.item_id) ? item.item_id : 0}`
    }
    if (item instanceof OtherInfo) {
      return `${name}-${hasValidId(item.id) ? item.id : 0}`
    }
    if (item instanceof PlayiconInfo) {
      return `${name}-${hasValidId(item.id) ? item.id : 0}`
    }
    return `${name}-0`
  }
  const getUniqueFilename = (filename: string) => {
    const nextCount = (filenameCountMap.get(filename) ?? 0) + 1
    filenameCountMap.set(filename, nextCount)
    if (nextCount === 1) {
      return filename
    }
    const splitIndex = filename.lastIndexOf('.')
    if (splitIndex <= 0) {
      return `${filename}_${nextCount - 1}`
    }
    return `${filename.slice(0, splitIndex)}_${nextCount - 1}${filename.slice(splitIndex)}`
  }
  for (const [pkg, set] of selectedSets.value) {
    const packageName = getSafeName(pkg.name)
    const groupNameParts = packageName.split('-')
    const subGroupName = groupNameParts.slice(1).join('-')
    const basePath = subGroupName ? `${groupNameParts[0]}/${subGroupName}` : groupNameParts[0]
    const cardKeyMap = buildCardKeyMap(pkg)
    for (const cardKey of set) {
      const target = cardKeyMap.get(cardKey)
      if (!target) {
        continue
      }
      if (target instanceof CardInfo) {
        const nameIdPrefix = getNameIdPrefix(target)
        files.push(new DownloadMetaData({
          url: target.img!,
          type: ItemType.StaticCard,
          filename: getUniqueFilename(`${basePath}/static/${nameIdPrefix}_card.${GetFileExtensionFromUrl(target.img!)}`),
          name: target.name
        }))
        if (target.video) {
          files.push(new DownloadMetaData({
            url: target.video![0]!,
            type: ItemType.AnimatedCard,
            filename: getUniqueFilename(`${basePath}/video/${nameIdPrefix}_video.${GetFileExtensionFromUrl(target.video![0]!)}`),
            name: target.name
          }))
        }
        if (target.watermarked) {
          if (target.watermarked.img) {
            files.push(new DownloadMetaData({
              url: target.watermarked.img!,
              type: ItemType.StaticCardWatermarked,
              filename: getUniqueFilename(`${basePath}/static_watermarked/${nameIdPrefix}_watermarked.${GetFileExtensionFromUrl(target.watermarked.img)}`),
              name: target.name
            }))
          }
          if (target.watermarked.video) {
            files.push(new DownloadMetaData({
              url: target.watermarked.video![0]!,
              type: ItemType.AnimatedCardWatermarked,
              filename: getUniqueFilename(`${basePath}/video_watermarked/${nameIdPrefix}_video_watermarked.${GetFileExtensionFromUrl(target.watermarked.video![0]!)}`),
              name: target.name
            }))
          }
        }
        continue
      } else if (target instanceof EmojiInfo) {
        const nameIdPrefix = getNameIdPrefix(target)
        files.push(new DownloadMetaData({
          url: target.images.static!,
          type: ItemType.StaticSticker,
          filename: getUniqueFilename(`${basePath}/png/${nameIdPrefix}_sticker_static.${GetFileExtensionFromUrl(target.images.static!)}`),
          name: target.name
        }))
        if (target.images.webp) {
          files.push(new DownloadMetaData({
            url: target.images.webp!,
            type: ItemType.WebpSticker,
            filename: getUniqueFilename(`${basePath}/webp/${nameIdPrefix}_sticker_webp.${GetFileExtensionFromUrl(target.images.webp!)}`),
            name: target.name
          }))
        }
        if (target.images.gif) {
          files.push(new DownloadMetaData({
            url: target.images.gif!,
            type: ItemType.GifSticker,
            filename: getUniqueFilename(`${basePath}/gif/${nameIdPrefix}_sticker_gif.${GetFileExtensionFromUrl(target.images.gif!)}`),
            name: target.name
          }))
        }
        continue
      } else if (target instanceof OtherInfo) {
        const nameIdPrefix = getNameIdPrefix(target)
        files.push(new DownloadMetaData({
          url: target.img!,
          filename: getUniqueFilename(`${basePath}/${nameIdPrefix}_other.${GetFileExtensionFromUrl(target.img!)}`),
          type: ItemType.Other,
          name: target.name
        }))
        continue
      } else if (target instanceof LoadingInfo) {
        const nameIdPrefix = getNameIdPrefix(target)
        files.push(new DownloadMetaData({
          url: target.animated!,
          filename: getUniqueFilename(`${basePath}/loading/${nameIdPrefix}_loading.${GetFileExtensionFromUrl(target.animated!)}`),
          type: ItemType.WebpSticker,
          name: target.name
        }))
        continue
      } else if (target instanceof ThumbupInfo) {
        const nameIdPrefix = getNameIdPrefix(target)
        files.push(new DownloadMetaData({
          url: target.url!,
          filename: getUniqueFilename(`${basePath}/thumbup/${nameIdPrefix}_thumbup.png`),
          type: ItemType.SVGA,
          name: target.name
        }))
        continue
      } else if (target instanceof PlayiconInfo) {
        const nameIdPrefix = getNameIdPrefix(target)
        if (target.isLottie) {
          const  icon = target.icon as PlayiconInfo.LottieIcon
          files.push(new DownloadMetaData({
            url: icon.drag,
            filename: getUniqueFilename(`${basePath}/playicon/${nameIdPrefix}_playicon_drag.json`),
            type: ItemType.PlayIconLottie,
            name: target.name
          }))
          files.push(new DownloadMetaData({
            url: icon.normal!,
            filename: getUniqueFilename(`${basePath}/playicon/${nameIdPrefix}_playicon_normal.json`),
            type: ItemType.PlayIconLottie,
            name: target.name
          }))
        } else {
          const icon = target.icon as PlayiconInfo.StaticIcon
          files.push(new DownloadMetaData({
            url: icon.dragLeft!,
            filename: getUniqueFilename(`${basePath}/playicon/${nameIdPrefix}_playicon_drag_left.png`),
            type: ItemType.PlayIconStatic,
            name: target.name
          }))
          files.push(new DownloadMetaData({
            url: icon.normal!,
            filename: getUniqueFilename(`${basePath}/playicon/${nameIdPrefix}_playicon_normal.png`),
            type: ItemType.PlayIconStatic,
            name: target.name
          }))
          files.push(new DownloadMetaData({
            url: icon.dragRight!,
            filename: getUniqueFilename(`${basePath}/playicon/${nameIdPrefix}_playicon_drag_right.png`),
            type: ItemType.PlayIconStatic,
            name: target.name
          }))
        }
        files.push(new DownloadMetaData({
          url: target.icon.preview!,
          filename: getUniqueFilename(`${basePath}/playicon/${nameIdPrefix}_playicon_preview.${GetFileExtensionFromUrl(target.icon.preview!)}`),
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
    <div data-tour="detail-query" class="flex justify-center-safe items-center-safe gap-1 min-h-9 flex-wrap">
      <USelect
v-model="ParsedResult.type" data-tour="detail-type" icon="i-material-symbols-category" class="w-32 max-sm:grow" value-key="id"
        :items="selectItem" />
      <UInput v-model="ParsedResult.id" data-tour="detail-id" icon="i-mdi-identifier" class="w-64 max-sm:grow" placeholder="id" />
      <UButton
data-tour="detail-fetch" trailing-icon="i-ic-arrow-forward" size="md" variant="outline" color="secondary" class="w-full sm:w-auto text-nowrap"
        :loading="fetching" @click="fetchData">
        获取数据
      </UButton>
    </div>
    <UProgress v-if="fetching" class="mt-3" animation="carousel" aria-label="正在获取数据" />
    <USeparator class="m-2" size="md" />
    <div data-tour="detail-select" class="flex justify-center-safe items-center flex-wrap gap-4 max-sm:gap-1 ">
      <div class="flex justify-center-safe items-center gap-1 grow">
        <USelectMenu
v-model="currentPackage" data-tour="detail-package" class="min-w-40 grow" label-key="name" :items="ItemsArray as any"
          @change="refreshSelectedCards" />
        <UCheckbox
v-model="checked" data-tour="detail-select-all" :disabled="currentPackage.id === 0" label="全选" class="justify-center text-nowrap"
          size="lg" @change="toggleSelectAllCards" />
      </div>
      <UButton
data-tour="detail-download" class="max-sm:grow text-nowrap" color="primary" variant="outline" icon="i-mdi-download"
        @click="download">下载
      </UButton>
    </div>
    <USeparator class="m-2" size="md" />
    <div v-if="currentPackage.id !== 0" data-tour="detail-cards" style="display: flex; flex-flow: row;">
      <div class="flex justify-center-safe items-center flex-wrap gap-2 h-full">
        <TransitionGroup name="opacity-card" appear>
          <ShowCard
v-for="object in currentPackage.data" :key="MD5(object)" :url="object"
            :highlight="queryCardIsSelected(object, currentPackage)"
            @click="setActiveCard(object, currentPackage)"/>
        </TransitionGroup>
      </div>
      <UCard
data-tour="detail-selection-tree" class="hidden lg:block overflow-y-auto ml-auto" style="min-width: 300px; max-height: 500px;"
        variant="outline_nopadding">
        <UTree
v-if="generatedTreeData.length !== 0" :items="generatedTreeData" @select="(e: TreeItemSelectEvent<TreeItem>) => {
          if (e.detail.originalEvent.type === 'click') {
            e.preventDefault()
          }
        }">
          <template #checkable="{ item }">
            <UCheckbox
:key="treeDataKey" class="w-full text-left" :model-value="true" :label="(item as { label: string }).label" @change="() => {
              let data = (item as { package: number, packageRef: DetailedData, label: string, cardKey: string })
              removeCardByKey(data.cardKey, data.packageRef);
            }"/>
          </template>
        </UTree>
        <div v-else>
          <USeparator class="pt-4" label="还没有数据哦" size="lg" />
        </div>
      </UCard>
    </div>
    <USeparator v-else data-tour="detail-cards" class="pt-4" label="还没有数据哦" size="lg" />
    <DownloadModal
:open="downloadPanelOpen" :file-metadatas="downloadFiles"
      @close="() => { downloadPanelOpen = false }" />
    <OnboardingTour tour-id="detail" :steps="onboardingSteps" />
  </div>
</template>
