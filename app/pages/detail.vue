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
    description: '点击后加载资源包；已选项目会保留，可以继续获取并选择其他 ID。',
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
    description: '桌面端右侧会按来源 ID 汇总全部已选项目，也可以在这里单独取消项目。',
    icon: 'i-mdi-file-tree-outline',
    target: '[data-tour="detail-selection-tree"]',
  },
  {
    title: '设置并开始下载',
    description: '开始下载时会刷新所有已选来源的资源链接，再建立下载队列。',
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

type DownloadSourceType = ParsedType.DLC | ParsedType.THEME

interface DownloadSource {
  type: DownloadSourceType
  id: number
}

interface SelectedPackage {
  source: DownloadSource
  packageKey: string
  packageData: DetailedData
  cardKeys: Set<string>
}

const activeSource = ref<DownloadSource>()
const selectedPackages = ref<Map<string, SelectedPackage>>(new Map())

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

function getSourceKey(source: DownloadSource): string {
  return `${source.type}:${source.id}`
}

function getSourceLabel(source: DownloadSource): string {
  return `${source.type === ParsedType.DLC ? '收藏集' : '主题'} ID ${source.id}`
}

function getPackageKey(pkg: DetailedData): string {
  return hasValidId(pkg.id)
    ? `${pkg.type}:${pkg.id}`
    : `${pkg.type}:name:${getSafeName(pkg.name)}`
}

function getSelectionKey(source: DownloadSource, pkg: DetailedData): string {
  return `${getSourceKey(source)}:${getPackageKey(pkg)}`
}

function sourceMatches(left: DownloadSource | undefined, right: DownloadSource): boolean {
  return left?.type === right.type && left.id === right.id
}

async function fetchSourcePackages(source: DownloadSource, onWarning?: (message: string) => void): Promise<DetailedData[]> {
  const packages = source.type === ParsedType.DLC
    ? await GetCollectionMigratedData(source.id, onWarning)
    : await GetSuitDetails(source.id, onWarning)
  return normalizePackages(packages)
}

function reconcileSelectedPackages(source: DownloadSource, packages: DetailedData[]) {
  const packageMap = new Map(packages.map(pkg => [getPackageKey(pkg), pkg]))
  const nextSelections = new Map(selectedPackages.value)
  let changed = false

  for (const [selectionKey, selection] of nextSelections) {
    if (!sourceMatches(selection.source, source)) continue
    const refreshedPackage = packageMap.get(selection.packageKey)
    if (!refreshedPackage) continue
    nextSelections.set(selectionKey, { ...selection, packageData: refreshedPackage })
    changed = true
  }

  if (changed) {
    selectedPackages.value = nextSelections
  }
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
  const source: DownloadSource = {
    type: ParsedResult.value.type as DownloadSourceType,
    id
  }
  const isCollection = source.type === ParsedType.DLC
  const typeLabel = isCollection ? '收藏集' : '主题'
  const warnings: string[] = []
  const { public: { EnableTrace } } = useRuntimeConfig()
  try {
    try { if (EnableTrace) umTrackEvent('detail', { type: isCollection ? 'DLC' : 'THEME', id: String(id) }) } catch { /* empty */ }
    const packages = await fetchSourcePackages(source, message => warnings.push(message))

    ItemsArray.value = packages
    activeSource.value = source
    reconcileSelectedPackages(source, packages)
    currentPackage.value = { id: 0, type: PackageType.Undefined, data: [] }
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

function getSelectedPackage(pkg: DetailedData, source = activeSource.value): SelectedPackage | undefined {
  if (!source) return undefined
  return selectedPackages.value.get(getSelectionKey(source, pkg))
}

function updatePackageSelection(pkg: DetailedData, cardKeys: Set<string>, source = activeSource.value) {
  if (!source) return
  const selectionKey = getSelectionKey(source, pkg)
  const nextSelections = new Map(selectedPackages.value)
  if (cardKeys.size === 0) {
    nextSelections.delete(selectionKey)
  } else {
    nextSelections.set(selectionKey, {
      source: { ...source },
      packageKey: getPackageKey(pkg),
      packageData: pkg,
      cardKeys: new Set(cardKeys)
    })
  }
  selectedPackages.value = nextSelections
}

function queryCardIsSelected(card: PackageDataType, pkg: DetailedData): boolean {
  return getSelectedPackage(pkg)?.cardKeys.has(getCardSelectKey(card)) ?? false
}

function removeCardByKey(cardKey: string, selectionKey: string) {
  const selection = selectedPackages.value.get(selectionKey)
  if (!selection) return
  const nextCardKeys = new Set(selection.cardKeys)
  nextCardKeys.delete(cardKey)
  updatePackageSelection(selection.packageData, nextCardKeys, selection.source)
  refreshSelectedCards()
}

function setActiveCard(currentCard: PackageDataType, pkg: DetailedData | undefined) {
  if (currentPackage.value.id === 0 || !pkg || !activeSource.value) {
    return
  }
  if (currentCard instanceof CardInfo || currentCard instanceof OtherInfo || currentCard instanceof EmojiInfo || currentCard instanceof LoadingInfo || currentCard instanceof ThumbupInfo || currentCard instanceof PlayiconInfo) {
    const cardMap = new Set(getSelectedPackage(pkg)?.cardKeys ?? [])
    const cardKey = getCardSelectKey(currentCard)
    if (cardMap.has(cardKey)) {
      cardMap.delete(cardKey)
    } else {
      cardMap.add(cardKey)
    }
    updatePackageSelection(pkg, cardMap)
  }
  refreshSelectedCards()
}

type DragSelectionMode = 'replace' | 'add' | 'toggle'

interface SelectionRectangle {
  left: number
  top: number
  width: number
  height: number
}

const cardSelectionArea = ref<HTMLElement>()
const selectionRectangle = ref<SelectionRectangle>()
const dragSelecting = ref(false)
const selectionRectangleStyle = computed(() => {
  const rectangle = selectionRectangle.value
  if (!rectangle) return {}
  return {
    left: `${rectangle.left}px`,
    top: `${rectangle.top}px`,
    width: `${rectangle.width}px`,
    height: `${rectangle.height}px`
  }
})

const dragThreshold = 5
let dragPointerId: number | undefined
let dragStartX = 0
let dragStartY = 0
let dragSelectionMode: DragSelectionMode = 'replace'
let dragSelectionBaseline = new Set<string>()
let dragPackage: DetailedData | undefined
let suppressNextCardClick = false
let suppressClickTimer: ReturnType<typeof setTimeout> | undefined

function removeDragSelectionListeners() {
  window.removeEventListener('pointermove', updateCardSelection)
  window.removeEventListener('pointerup', finishCardSelection)
  window.removeEventListener('pointercancel', finishCardSelection)
}

function startCardSelection(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || event.button !== 0 || dragPointerId !== undefined) return
  if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return

  dragPointerId = event.pointerId
  dragStartX = event.clientX
  dragStartY = event.clientY
  dragPackage = currentPackage.value
  dragSelectionBaseline = new Set(getSelectedPackage(currentPackage.value)?.cardKeys ?? [])
  dragSelectionMode = event.ctrlKey || event.metaKey
    ? 'toggle'
    : event.shiftKey
      ? 'add'
      : 'replace'

  window.addEventListener('pointermove', updateCardSelection)
  window.addEventListener('pointerup', finishCardSelection)
  window.addEventListener('pointercancel', finishCardSelection)
}

function updateCardSelection(event: PointerEvent) {
  if (event.pointerId !== dragPointerId || !dragPackage) return

  const movedX = event.clientX - dragStartX
  const movedY = event.clientY - dragStartY
  if (!dragSelecting.value && Math.hypot(movedX, movedY) < dragThreshold) return

  const area = cardSelectionArea.value
  if (!area) return

  event.preventDefault()
  dragSelecting.value = true

  const areaBounds = area.getBoundingClientRect()
  const currentX = Math.min(Math.max(event.clientX, areaBounds.left), areaBounds.right)
  const currentY = Math.min(Math.max(event.clientY, areaBounds.top), areaBounds.bottom)
  const selectionBounds = {
    left: Math.min(dragStartX, currentX),
    top: Math.min(dragStartY, currentY),
    right: Math.max(dragStartX, currentX),
    bottom: Math.max(dragStartY, currentY)
  }

  selectionRectangle.value = {
    left: selectionBounds.left - areaBounds.left,
    top: selectionBounds.top - areaBounds.top,
    width: selectionBounds.right - selectionBounds.left,
    height: selectionBounds.bottom - selectionBounds.top
  }

  const hitKeys = new Set<string>()
  area.querySelectorAll<HTMLElement>('[data-card-key]').forEach((cardElement) => {
    const cardBounds = cardElement.getBoundingClientRect()
    const intersects = selectionBounds.left <= cardBounds.right
      && selectionBounds.right >= cardBounds.left
      && selectionBounds.top <= cardBounds.bottom
      && selectionBounds.bottom >= cardBounds.top
    const cardKey = cardElement.dataset.cardKey
    if (intersects && cardKey) {
      hitKeys.add(cardKey)
    }
  })

  let nextSelection: Set<string>
  if (dragSelectionMode === 'add') {
    nextSelection = new Set([...dragSelectionBaseline, ...hitKeys])
  } else if (dragSelectionMode === 'toggle') {
    nextSelection = new Set(dragSelectionBaseline)
    hitKeys.forEach((cardKey) => {
      if (nextSelection.has(cardKey)) {
        nextSelection.delete(cardKey)
      } else {
        nextSelection.add(cardKey)
      }
    })
  } else {
    nextSelection = hitKeys
  }

  const currentSelection = getSelectedPackage(dragPackage)?.cardKeys
  const selectionUnchanged = currentSelection?.size === nextSelection.size
    && [...nextSelection].every(cardKey => currentSelection.has(cardKey))
  if (selectionUnchanged) return

  updatePackageSelection(dragPackage, nextSelection)
  refreshSelectedCards()
}

function finishCardSelection(event: PointerEvent) {
  if (event.pointerId !== dragPointerId) return

  removeDragSelectionListeners()
  dragPointerId = undefined
  dragPackage = undefined
  selectionRectangle.value = undefined

  if (dragSelecting.value) {
    suppressNextCardClick = true
    if (suppressClickTimer) clearTimeout(suppressClickTimer)
    suppressClickTimer = setTimeout(() => {
      suppressNextCardClick = false
    }, 150)
  }
  dragSelecting.value = false
}

function handleCardClick(currentCard: PackageDataType, pkg: DetailedData, event?: MouseEvent | KeyboardEvent) {
  if (suppressNextCardClick && event?.type === 'click') {
    suppressNextCardClick = false
    if (suppressClickTimer) clearTimeout(suppressClickTimer)
    return
  }
  setActiveCard(currentCard, pkg)
}

onBeforeUnmount(() => {
  removeDragSelectionListeners()
  if (suppressClickTimer) clearTimeout(suppressClickTimer)
})

function toggleSelectAllCards() {
  if (currentPackage.value.id === 0) {
    return
  }
  if (checked.value === true) {
    const newSet = new Set<string>()
    currentPackage.value.data.forEach((card) => {
      newSet.add(getCardSelectKey(card))
    })
    updatePackageSelection(currentPackage.value, newSet)
  } else {
    updatePackageSelection(currentPackage.value, new Set())
  }
}

function refreshSelectedCards() {
  if (currentPackage.value.id === 0) {
    return
  }
  const cardMap = getSelectedPackage(currentPackage.value)?.cardKeys
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
const selectedItemCount = computed(() => [...selectedPackages.value.values()]
  .reduce((total, selection) => total + selection.cardKeys.size, 0))
const animatedPreviewEnabled = ref(false)
const hasAnimatedCards = computed(() => currentPackage.value.data.some(item => {
  return item instanceof CardInfo
    && Boolean(item.video?.some(url => Boolean(url)) || item.watermarked?.video?.some(url => Boolean(url)))
}))
const selectedSourceCount = computed(() => new Set(
  [...selectedPackages.value.values()].map(selection => getSourceKey(selection.source))
).size)

function clearAllSelections() {
  selectedPackages.value = new Map()
  checked.value = false
}

watch(selectedPackages, () => {
  const sourceItems = new Map<string, TreeItem>()
  for (const [selectionKey, selection] of selectedPackages.value) {
    const pkg = selection.packageData
    const cardSet = selection.cardKeys
    if (cardSet.size === 0) continue

    const sourceKey = getSourceKey(selection.source)
    let sourceItem = sourceItems.get(sourceKey)
    if (!sourceItem) {
      sourceItem = {
        label: getSourceLabel(selection.source),
        children: []
      }
      sourceItems.set(sourceKey, sourceItem)
    }
    const packageItem: TreeItem = {
      label: pkg.name,
      children: []
    }
    sourceItem.children!.push(packageItem)
    const cardKeyMap = buildCardKeyMap(pkg)
    cardSet.forEach(cardKey => {
      const target = cardKeyMap.get(cardKey)
      packageItem.children!.push({
        label: target?.name ?? 'Unknown Item',
        slot: 'checkable' as const,
        package: pkg.id,
        cardKey: cardKey,
        selectionKey
      })
    })
  }
  generatedTreeData.value = [...sourceItems.values()]
  treeDataKey.value = Date.now()
}, { deep: true, immediate: true })

const downloadPanelOpen = ref(false)
function download() {
  downloadFiles.value = buildDownloadFiles([...selectedPackages.value.values()])
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

function buildDownloadFiles(selections: SelectedPackage[]): Array<DownloadMetaData> {
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
  for (const selection of selections) {
    const pkg = selection.packageData
    const set = selection.cardKeys
    const sourcePath = `${selection.source.type === ParsedType.DLC ? '收藏集' : '主题'}-${selection.source.id}`
    const packageName = getSafeName(pkg.name)
    const groupNameParts = packageName.split('-')
    const subGroupName = groupNameParts.slice(1).join('-')
    const packagePath = subGroupName ? `${groupNameParts[0]}/${subGroupName}` : groupNameParts[0]
    const basePath = `${sourcePath}/${packagePath}`
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

async function refreshSelectedDownloadFiles(): Promise<DownloadMetaData[]> {
  const selections = [...selectedPackages.value.values()].filter(selection => selection.cardKeys.size > 0)
  if (selections.length === 0) return []

  const sourceGroups = new Map<string, { source: DownloadSource, selections: SelectedPackage[] }>()
  for (const selection of selections) {
    const sourceKey = getSourceKey(selection.source)
    const group = sourceGroups.get(sourceKey)
    if (group) {
      group.selections.push(selection)
    } else {
      sourceGroups.set(sourceKey, { source: selection.source, selections: [selection] })
    }
  }

  const refreshedSelections: SelectedPackage[] = []
  const nextSelections = new Map(selectedPackages.value)
  const refreshWarnings: string[] = []
  let refreshedActivePackages: DetailedData[] | undefined

  for (const { source, selections: sourceSelections } of sourceGroups.values()) {
    const sourceWarnings: string[] = []
    let packages: DetailedData[]
    try {
      packages = await fetchSourcePackages(source, message => sourceWarnings.push(message))
    } catch (error) {
      throw new Error(`${getSourceLabel(source)}链接刷新失败：${getErrorMessage(error, '请稍后重试')}`, { cause: error })
    }

    if (sourceWarnings.length > 0) {
      refreshWarnings.push(`${getSourceLabel(source)}：${sourceWarnings.join('；')}`)
    }
    if (sourceMatches(activeSource.value, source)) {
      refreshedActivePackages = packages
    }

    const packageMap = new Map(packages.map(pkg => [getPackageKey(pkg), pkg]))
    for (const selection of sourceSelections) {
      const selectionKey = getSelectionKey(source, selection.packageData)
      const refreshedPackage = packageMap.get(selection.packageKey)
      if (!refreshedPackage) {
        refreshWarnings.push(`${getSourceLabel(source)}中的“${selection.packageData.name ?? '未命名资源包'}”已不存在`)
        nextSelections.delete(selectionKey)
        continue
      }

      const refreshedCardMap = buildCardKeyMap(refreshedPackage)
      const availableCardKeys = new Set([...selection.cardKeys].filter(cardKey => refreshedCardMap.has(cardKey)))
      const missingCount = selection.cardKeys.size - availableCardKeys.size
      if (missingCount > 0) {
        refreshWarnings.push(`${getSourceLabel(source)}的“${refreshedPackage.name ?? '未命名资源包'}”有 ${missingCount} 个项目已不存在`)
      }

      const refreshedSelection: SelectedPackage = {
        ...selection,
        packageData: refreshedPackage,
        cardKeys: availableCardKeys
      }
      if (availableCardKeys.size > 0) {
        refreshedSelections.push(refreshedSelection)
        nextSelections.set(selectionKey, refreshedSelection)
      } else {
        nextSelections.delete(selectionKey)
      }
    }
  }

  selectedPackages.value = nextSelections
  if (refreshedActivePackages) {
    const currentPackageKey = currentPackage.value.id === 0 ? undefined : getPackageKey(currentPackage.value)
    ItemsArray.value = refreshedActivePackages
    currentPackage.value = currentPackageKey
      ? refreshedActivePackages.find(pkg => getPackageKey(pkg) === currentPackageKey)
        ?? { id: 0, type: PackageType.Undefined, data: [] }
      : currentPackage.value
    refreshSelectedCards()
  }

  const files = buildDownloadFiles(refreshedSelections)
  if (files.length === 0) {
    throw new Error('刷新后没有可下载的已选项目')
  }
  if (refreshWarnings.length > 0) {
    toast.add({
      title: '下载链接已刷新，部分项目发生变化',
      description: refreshWarnings.join('；'),
      icon: 'i-mdi-alert-circle',
      color: 'warning'
    })
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
      <UBadge v-if="selectedItemCount > 0" color="neutral" variant="soft" size="md">
        {{ selectedSourceCount }} 个来源 · {{ selectedItemCount }} 项
      </UBadge>
      <UButton
        v-if="selectedItemCount > 0"
        icon="i-mdi-selection-remove"
        color="neutral"
        variant="ghost"
        aria-label="清空全部已选项目"
        title="清空全部已选项目"
        @click="clearAllSelections"
      />
      <USwitch
        v-if="hasAnimatedCards"
        v-model="animatedPreviewEnabled"
        label="动态预览"
        checked-icon="i-mdi-play"
        unchecked-icon="i-mdi-image-outline"
        size="md"
      />
      <UButton
data-tour="detail-download" class="max-sm:grow text-nowrap" color="primary" variant="outline" icon="i-mdi-download"
        @click="download">{{ selectedItemCount > 0 ? `下载（${selectedItemCount}）` : '下载' }}
      </UButton>
    </div>
    <USeparator class="m-2" size="md" />
    <div v-if="currentPackage.id !== 0" data-tour="detail-cards" style="display: flex; flex-flow: row;">
      <div
        ref="cardSelectionArea"
        class="card-selection-area flex justify-center-safe items-center flex-wrap gap-2 h-full grow min-w-0"
        :class="{ 'is-box-selecting': dragSelecting }"
        @pointerdown="startCardSelection"
      >
        <div
          v-if="selectionRectangle"
          class="selection-rectangle"
          :style="selectionRectangleStyle"
          aria-hidden="true"
        />
        <TransitionGroup name="opacity-card" appear>
          <div
            v-for="object in currentPackage.data"
            :key="MD5(object)"
            class="selectable-card"
            :data-card-key="getCardSelectKey(object)"
          >
            <ShowCard
              :url="object"
              :highlight="queryCardIsSelected(object, currentPackage)"
              :preview-disabled="dragSelecting"
              :animated-preview="animatedPreviewEnabled"
              @click="handleCardClick(object, currentPackage, $event)"
            />
          </div>
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
              let data = (item as { package: number, selectionKey: string, label: string, cardKey: string })
              removeCardByKey(data.cardKey, data.selectionKey);
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
:open="downloadPanelOpen" :file-metadatas="downloadFiles" :refresh-file-metadatas="refreshSelectedDownloadFiles"
      @close="() => { downloadPanelOpen = false }" />
    <OnboardingTour tour-id="detail" :steps="onboardingSteps" />
  </div>
</template>

<style scoped>
.card-selection-area {
  position: relative;
  user-select: none;
}

.selectable-card {
  position: relative;
}

.selection-rectangle {
  position: absolute;
  border: 1px solid var(--ui-color-primary-500);
  border-radius: 4px;
  background: color-mix(in srgb, var(--ui-color-primary-500) 16%, transparent);
  pointer-events: none;
  z-index: 20;
}

.is-box-selecting,
.is-box-selecting :deep(.show-card) {
  cursor: crosshair;
}
</style>
