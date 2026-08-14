<script setup lang="ts">
import QrcodeDecoder from "qrcode-decoder/dist/index.esm.js";
import { GetForwardedLink, ParsedType, ParseIdFromLink } from "~/utils/Preprocess";
import type { CollectionCSVData, CSVDefinition, SearchInfo } from "~~/types/api/inner/types";
import type { ApiResponse } from "~~/types/api/root";
import type { SelectItem, TabsItem } from "@nuxt/ui";
import Papa from 'papaparse';
import { createApiResponseError, getErrorMessage } from '~/utils/apiError';
import { fetchBilibiliApi } from '~/utils/bilibiliApiFetch';

const router = useRouter();
const toast = useToast()
const onboardingSteps = [
  {
    title: '选择识别方式',
    description: '这里可以在关键词搜索、二维码识别和名称列表之间切换。',
    icon: 'i-mdi-tab-search',
    target: '[data-tour="search-modes"]',
    tab: 'search',
  },
  {
    title: '输入搜索关键词',
    description: '输入收藏集、主题或装扮名称。',
    icon: 'i-mdi-magnify',
    target: '[data-tour="search-keyword"]',
    tab: 'search',
  },
  {
    title: '开始搜索',
    description: '点击搜索按钮提交关键词；加载期间按钮和进度条会显示状态。',
    icon: 'i-mdi-magnify',
    target: '[data-tour="search-submit"]',
    tab: 'search',
  },
  {
    title: '选择搜索结果',
    description: '点击结果卡片后，类型和 ID 会自动填入页面底部。',
    icon: 'i-mdi-card-search-outline',
    target: '[data-tour="search-results"]',
    tab: 'search',
  },
  {
    title: '加载更多结果',
    description: '结果不完整时，使用加载更多继续获取下一页。',
    icon: 'i-mdi-refresh',
    target: '[data-tour="search-results"]',
    tab: 'search',
  },
  {
    title: '切换到二维码识别',
    description: '引导已切换到二维码标签，可通过图片直接识别资源链接。',
    icon: 'i-mdi-qrcode-scan',
    target: '[data-tour="search-modes"]',
    tab: 'qrcode',
  },
  {
    title: '选择二维码图片',
    description: '选择包含哔哩哔哩资源链接的二维码图片，识别成功后会自动填写结果。',
    icon: 'i-mdi-image-search-outline',
    target: '[data-tour="search-qrcode"]',
    tab: 'qrcode',
  },
  {
    title: '切换到名称列表',
    description: '搜索不到收藏集时，可以改用完整名称列表查找。',
    icon: 'i-mdi-format-list-bulleted',
    target: '[data-tour="search-modes"]',
    tab: 'idsearch',
  },
  {
    title: '加载名称数据',
    description: '先加载最新 CSV 数据，随后才能从名称列表中选择收藏集。',
    icon: 'i-mdi-database-arrow-down-outline',
    target: '[data-tour="search-csv-load"]',
    tab: 'idsearch',
  },
  {
    title: '选择收藏集',
    description: '输入名称筛选并选择目标收藏集，ID 会自动填入。',
    icon: 'i-mdi-form-select',
    target: '[data-tour="search-csv-select"]',
    tab: 'idsearch',
  },
  {
    title: '确认资源类型',
    description: '核对自动识别的类型，也可以手动改为收藏集或主题。',
    icon: 'i-material-symbols-category',
    target: '[data-tour="search-result-type"]',
    tab: 'search',
  },
  {
    title: '确认资源 ID',
    description: '核对识别得到的 ID，必要时可以手动输入。',
    icon: 'i-mdi-identifier',
    target: '[data-tour="search-result-id"]',
    tab: 'search',
  },
  {
    title: '确认并进入详情',
    description: '确认类型和 ID 后进入详情页，继续选择具体资源。',
    icon: 'i-mdi-arrow-right-circle-outline',
    target: '[data-tour="search-next-button"]',
    tab: 'search',
  },
]
const activeSearchTab = ref<string | number>('search')

function handleTourStepChange(index: number) {
  const tab = onboardingSteps[index]?.tab
  if (tab) activeSearchTab.value = tab
}

const searchKeyword = ref('')
const tabItems = ref<TabsItem[]>([
  {
    label: '搜索',
    icon: 'i-mdi-magnify',
    slot: 'search',
    value: 'search',
  },
  {
    label: '二维码扫描',
    icon: 'i-mdi-qrcode-scan',
    slot: 'qrcode',
    value: 'qrcode',
  },
  {
    label: '查找无法搜索到的收藏集',
    icon: 'i-mdi-alpha-a-box',
    slot: 'idsearch',
    value: 'idsearch',
  }
])
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
const QRScan = ref<HTMLInputElement | null>(null)
const ParsedResult: Ref<{ type: ParsedType; id: string }> = ref({ type: ParsedType.NONE, id: '' })
const parsingQRCode = ref(false)

const searchPage = ref(1)
const searchItems = ref<SearchInfo[]>([])
const hasMoreResults = ref(true)

// 简化并发控制，避免重复触发：使用布尔锁代替 Mutex
const searching = ref(false)

async function parseQRCode(e: Event) {
  const { public: { EnableTrace } } = useRuntimeConfig()
  if (!(e.target instanceof HTMLInputElement && e.target === QRScan.value)) return
  const input = e.target
  const file = input.files?.[0]
  if (!file) return
  const URI = URL.createObjectURL(file)
  const qr = new QrcodeDecoder()
  parsingQRCode.value = true
  try { if (EnableTrace) umTrackEvent('qrcode') } catch { /* empty */ }
  try {
    const res = await qr.decodeFromImage(URI)
    if (!res) {
      toast.add({
        title: '处理二维码时出现了一些问题',
        description: '无法识别该二维码，请重试。',
        icon: 'i-mdi-exclamation-thick',
        color: 'warning'
      })
      return
    }
    const forwardedLink = await GetForwardedLink(res.data)
    const parsed = ParseIdFromLink(forwardedLink)
    if (parsed.type === ParsedType.NONE) {
      toast.add({
        title: '无法从二维码中解析到有效的id',
        icon: 'i-mdi-exclamation-thick',
        color: 'warning'
      })
      return
    }
    updateResult(parsed.type, parsed.id)
  } catch (error) {
    console.error('Failed to parse QR code:', error)
    toast.add({
      title: '无法处理该二维码内容',
      description: getErrorMessage(error, '该二维码内容无法被识别为有效链接。'),
      icon: 'i-mdi-exclamation-thick',
      color: 'error'
    })
  } finally {
    URL.revokeObjectURL(URI)
    input.value = ''
    parsingQRCode.value = false
  }
}

async function searchForKeyword(keyword: string, page: number): Promise<boolean> {
  if (searching.value) return false
  const normalizedKeyword = keyword.trim()
  if (normalizedKeyword.length === 0) {
    toast.add({
      title: '请输入搜索关键词',
      icon: 'i-mdi-exclamation-thick',
      color: 'warning'
    })
    return false
  }

  const targetPage = Math.max(1, page)
  searching.value = true
  const { public: { EnableTrace } } = useRuntimeConfig()
  try {
    try { if (EnableTrace) umTrackEvent('search', { keyword: normalizedKeyword }) } catch { /* empty */ }
    const resp = await fetchBilibiliApi(`/api/bili/collection/search?key_word=${encodeURIComponent(normalizedKeyword)}&page=${targetPage}`)
    if (!resp.ok) {
      throw await createApiResponseError(resp, '搜索')
    }
    const result = await resp.json() as ApiResponse<SearchInfo[]>
    if (result.code !== 0 || !result.data) {
      throw new Error(result.message || '接口未返回有效数据')
    }
    if (result.data.length === 0) {
      hasMoreResults.value = false
      toast.add({
        title: targetPage === 1 ? '未找到相关结果' : '没有更多结果了',
        icon: 'i-mdi-magnify-close',
        color: 'info'
      })
      if (targetPage === 1) searchItems.value = []
      return false
    }

    searchItems.value = targetPage === 1 ? result.data : [...searchItems.value, ...result.data]
    searchPage.value = targetPage
    hasMoreResults.value = true
    return true
  } catch (error) {
    toast.add({
      title: '搜索时出现错误',
      description: getErrorMessage(error, '请稍后重试。'),
      icon: 'i-mdi-exclamation-thick',
      color: 'error'
    })
    return false
  } finally {
    searching.value = false
  }
}

function switchToDetailPage() {
  router.push({
    path: '/detail',
    query: {
      type: ParsedResult.value.type.toString(),
      id: ParsedResult.value.id
    }
  })
}

function updateResult(type: ParsedType, id: string) {
  ParsedResult.value.type = type
  ParsedResult.value.id = id
  toast.add({
    title: '解析成功',
    description: '点击下一步继续。',
    icon: 'i-mdi-check-bold',
    color: 'success',
  })
}

const loadingCSV = ref(false)
const loadedCollectionIDs = ref<Array<{ act_id: string, act_title: string }>>([])
const CSVSelectedID = ref<string>("")

async function loadCSV() {
  if (loadingCSV.value) return
  loadingCSV.value = true
  const { public: { EnableTrace } } = useRuntimeConfig()
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  try { EnableTrace && umTrackEvent('csv') } catch { /* empty */ }

  try {
      const resp = await fetch('/api/latestCollectionsMap', { cache: 'default' })
      if (!resp.ok) throw await createApiResponseError(resp, '加载收藏集名称列表')
      const result = await resp.json() as ApiResponse<CollectionCSVData>
      if (result.code !== 0 || !result.data) {
        throw new Error(result.message || '接口未返回有效数据')
      }
      const parsedCSV = Papa.parse<{ act_id: string; act_title: string }>(result.data['data'], {
        header: true,
        skipEmptyLines: true,
      }).data as CSVDefinition[];

      loadedCollectionIDs.value = [...parsedCSV.filter(item => item.status.toLowerCase() === "true")].map(item => ({
        act_id: item.act_id,
        act_title: item.act_title
      }))

      toast.add({
        title: '加载成功, 共 ' + loadedCollectionIDs.value.length + ' 条数据',
        description: '请从下拉菜单中选择收藏集',
        icon: 'i-mdi-check-bold',
        color: 'success',
      })
  } catch (error) {
      toast.add({
        title: '加载失败',
        description: getErrorMessage(error, '请稍后重试'),
        icon: 'i-mdi-exclamation-thick',
        color: 'error'
      })
  } finally {
    loadingCSV.value = false
  }
}

const tabOrientation = ref<'horizontal' | 'vertical'>('horizontal')

// 在 SSR 环境下 window 不存在，这里不要直接读取 window
const windowWidth = ref<number>(0)

onMounted(() => {
  checkScreenSize();
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', checkScreenSize);
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', checkScreenSize);
  }
})

const checkScreenSize = () => {
  if (typeof window === 'undefined') return
  windowWidth.value = window.innerWidth
  tabOrientation.value = windowWidth.value >= 640 ? 'horizontal' : 'vertical'
}
</script>

<template>
  <div>
    <UCard variant="subtle">
    <template #header>
      <h1 class="text-2xl font-semibold">关键词搜索或二维码识别</h1>
    </template>
    <div>
      <div class="flex justify-center-safe">
        <UTabs
          v-model="activeSearchTab"
          data-tour="search-modes"
:items="tabItems" class="w-full max-w-10/12 flex-col" :orientation="tabOrientation" :ui="{
          list: 'w-full'
        }">
          <template #search>
            <Transition name="opacity" mode="out-in" appear>
              <div key="search">
                <form data-tour="search-form" class="flex justify-center-safe mt-1" @submit.prevent="searchForKeyword(searchKeyword, 1)">
                  <UInput
v-model="searchKeyword" data-tour="search-keyword" class="w-11/12" type="search" icon="i-mdi-magnify" size="lg"
                    variant="outline" placeholder="Search..." />
                  <UButton
data-tour="search-submit" class="ml-2 w-9 flex justify-center" icon="i-mdi-magnify" size="md" color="primary"
                    variant="soft" type="submit" :loading="searching" aria-label="搜索" />
                </form>
                <USeparator class="mt-4 mb-2" size="md" />
                <div data-tour="search-results">
                  <UProgress v-if="searching" class="mb-3" animation="carousel" aria-label="正在搜索" />
                  <div v-if="searchItems.length !== 0">
                    <UPageGrid>
                    <TransitionGroup name="suit-card" mode="out-in" appear>
                      <UPageCard
v-for="searchItem in searchItems" :key="searchItem.name" variant="outline_nopadding"
                        class="flex justify-center-safe bg-default ring ring-default"
                        @click="updateResult(searchItem.type === 0 ? ParsedType.DLC : ParsedType.THEME, searchItem.id.toString())">
                        <div class="flex flex-nowrap items-center suit-card h-full">
                          <img
:src="`/api/bili/proxy?origin=${encodeURIComponent(searchItem.cover)}`" loading="lazy"
                            decoding="async"
                            :alt="searchItem.id.toString()" class=" max-w-1/3 h-max">
                          <div class="relative flex items-center pl-2 pr-2" style="width:100%; height:100%;">
                            <div
class="absolute inset-0 background-blur" :style="{
                              backgroundImage: `url('/api/bili/proxy?origin=${encodeURIComponent(searchItem.cover)}')`,
                            }" aria-hidden="true" />
                            <div class="relative z-10 w-full">
                              <p class="text-center" style="width: 100%;">{{ searchItem.name }}</p>
                            </div>
                          </div>
                        </div>
                      </UPageCard>
                    </TransitionGroup>
                    </UPageGrid>
                    <USeparator class="mt-2" />
                    <UButton
class="mt-2 w-full justify-center " icon="i-ic-refresh" :loading="searching"
                      :disabled="!hasMoreResults" @click="searchForKeyword(searchKeyword, searchPage + 1)">加载更多
                    </UButton>
                  </div>
                  <USeparator v-else class="pt-4" label="还没有数据哦" size="lg" />
                </div>
              </div>
            </Transition>
          </template>
          <template #qrcode>
            <Transition name="opacity" mode="out-in" appear>
              <div key="qrcode" class="flex justify-center-safe mt-1">
                <UButton
data-tour="search-qrcode" class="text-center" icon="i-mdi-qrcode-scan" size="lg" color="primary" variant="soft"
                  :loading="parsingQRCode"
                  @click="QRScan?.click()">
                  选择二维码
                </UButton>
                <input
ref="QRScan" type="file" accept="image/*" class="absolute w-0 h-0 overflow-hidden"
                  @change="parseQRCode">
              </div>
            </Transition>
          </template>
          <template #idsearch>
            <Transition name="opacity" mode="out-in" appear>
              <div key="idsearch" class="flex flex-col items-center mt-1">
                <p class="mb-4 text-center">如果你无法通过关键词搜索到你想要的收藏集, 可以尝试直接输入其名称</p>
                <div class="mb-4 flex items-center-safe w-full justify-center-safe">
                  <UButton data-tour="search-csv-load" class="mr-2" :loading="loadingCSV" @click="loadCSV()">加载CSV数据</UButton>
                  <USelectMenu
v-model="CSVSelectedID" data-tour="search-csv-select" icon="i-mdi-alpha-a-box" class="w-1/2" placeholder="请输入收藏集名称"
                    value-key="act_id" label-key="act_title" :items="loadedCollectionIDs" virtualize
                    @change.stop="updateResult(ParsedType.DLC, CSVSelectedID)">
                    <template #item-label="{ item }">
                      {{ item.act_title }}
                      <span class="text-muted">
                        {{ item.act_id }}
                      </span>
                    </template>
                  </USelectMenu>
                </div>
                <p>鸣谢: <a
style="text-decoration: underline;"
                    href="https://github.com/CaleyGoldue/bilibili-collections-archive" target="_blank"
                    rel="noopener noreferrer">CloudyEagle, CaleyGoldue</a></p>
              </div>
            </Transition>
          </template>
        </UTabs>
      </div>
    </div>
    <template #footer>
      <div data-tour="search-next" class="flex justify-center-safe items-center-safe gap-1 min-h-9 flex-wrap">
        <USelect
v-model="ParsedResult.type" data-tour="search-result-type" icon="i-material-symbols-category" class="w-32 max-sm:grow" value-key="id"
          :items="selectItem" />
        <UInput v-model="ParsedResult.id" data-tour="search-result-id" icon="i-mdi-identifier" class="w-64 max-sm:grow" placeholder="id" />
        <UButton
data-tour="search-next-button" trailing-icon="i-ic-arrow-forward" size="md" variant="outline" color="secondary"
          class="w-full sm:w-auto text-nowrap" @click="switchToDetailPage">下一步
        </UButton>
      </div>
    </template>
    </UCard>
    <OnboardingTour tour-id="search" :steps="onboardingSteps" @step-change="handleTourStepChange" />
  </div>
</template>

<style scoped>
.suit-card-enter-active,
.suit-card-leave-active {
  transition: all 0.4s ease;
}

.suit-card-enter-from,
.suit-card-leave-to {
  opacity: 0;
  transform: translateX(10px);
}
</style>
