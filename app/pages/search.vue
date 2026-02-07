<script setup lang="ts">
import QrcodeDecoder from "qrcode-decoder";
import { GetForwardedLink, ParsedType, ParseIdFromLink } from "~/utils/Preprocess";
import type { CollectionCSVData, CSVDefinition, SearchInfo } from "~~/types/api/inner/types";
import type { ApiResponse } from "~~/types/api/root";
import type { SelectItem, TabsItem } from "@nuxt/ui";
import Papa from 'papaparse';

const router = useRouter();
const toast = useToast()
const searchKeyword = ref('')
const tabItems = ref<TabsItem[]>([
  {
    label: '搜索',
    icon: 'i-mdi-magnify',
    slot: 'search'
  },
  {
    label: '二维码扫描',
    icon: 'i-mdi-qrcode-scan',
    slot: 'qrcode'
  },
  {
    label: '查找无法搜索到的收藏集',
    icon: 'i-mdi-alpha-a-box',
    slot: 'idsearch'
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

const searchPage = ref(1)
const searchItems = ref<SearchInfo[]>([])

// 简化并发控制，避免重复触发：使用布尔锁代替 Mutex
const searching = ref(false)

function parseQRCode(e: Event) {
  const { public: { EnableTrace } } = useRuntimeConfig()
  if (!(e.target instanceof HTMLInputElement && e.target === QRScan.value && QRScan.value?.files?.length && QRScan.value?.files?.length > 0)) return
  const file = e.target?.files?.[0]
  if (!file) return
  const URI = window.webkitURL.createObjectURL(file) || window.URL.createObjectURL(file)
  const qr = new QrcodeDecoder()
  try { EnableTrace && umTrackEvent('qrcode') } catch { }
  qr.decodeFromImage(URI).then((res) => {
    if (!res) {
      return toast.add({
        title: '处理二维码时出现了一些问题',
        description: '无法识别该二维码，请重试。',
        icon: 'i-mdi-exclamation-thick',
        color: 'warning'
      })
    }
    GetForwardedLink(res.data).then(s => {
      const parsed = ParseIdFromLink(s)
      if (parsed.type === ParsedType.NONE) {
        return toast.add({
          title: '无法从二维码中解析到有效的id',
          icon: 'i-mdi-exclamation-thick',
          color: 'warning'
        })
      }
      updateResult(parsed.type, parsed.id)
    }).catch(() => {
      toast.add({
        title: '无法处理该二维码内容',
        description: '该二维码内容无法被识别为有效链接。',
        icon: 'i-mdi-exclamation-thick',
        color: 'warning'
      })
    })
  }).catch((err) => {
    toast.add({
      title: 'Uh oh! Something went wrong.',
      description: 'Please check console for more details.',
      icon: 'i-mdi-exclamation-thick',
      color: 'error'
    })
    throw err
  })
}

async function searchForKeyword(keyword: string, page: number) {
  if (searching.value) return
  searching.value = true
  const { public: { EnableTrace } } = useRuntimeConfig()
  if (page < 1) {
    page = 1
  }
  if (page === 1) {
    searchItems.value = []
  }
  if (keyword.trim().length === 0) {
    searching.value = false
    return toast.add({
      title: '请输入搜索关键词',
      icon: 'i-mdi-exclamation-thick',
      color: 'warning'
    })
  }
  // 前端上报：搜索提交
  try { EnableTrace && umTrackEvent('search', { keyword: keyword }) } catch { }
  fetch(`/api/bili/collection/search?&key_word=${encodeURIComponent(keyword)}&page=${page}`, {
    method: 'GET'
  })
    .then(resp => {
      if (!resp.ok) {

        toast.add({
          title: '搜索时出现错误',
          description: `服务器返回错误：${resp.status}`,
          icon: 'i-mdi-exclamation-thick',
          color: 'error'
        })
        throw "skip"
      }
      return resp.json()
    })
    .then(data => data as ApiResponse<SearchInfo[]>)
    .then(result => {
      if (result.code !== 0 || !result.data) {

        toast.add({
          title: '搜索时出现错误',
          description: `错误信息：${result.message}`,
          icon: 'i-mdi-exclamation-thick',
          color: 'error'
        })
        throw "skip"
      }
      if (result.data.length === 0) {

        if (page === 1) {
          toast.add({
            title: '未找到相关结果',
            icon: 'i-mdi-magnify-close',
            color: 'info'
          })
        } else {
          toast.add({
            title: '没有更多结果了',
            icon: 'i-mdi-magnify-close',
            color: 'info'
          })
        }
        throw "skip"
      }

      searchItems.value = [...searchItems.value, ...result.data];
    })
    .catch(error => {
      if (error === "skip") {
        return
      }

      toast.add({
        title: '搜索时出现错误',
        description: '请稍后重试。',
        icon: 'i-mdi-exclamation-thick',
        color: 'error'
      })
      throw (error)
    }).finally(() => {
      searching.value = false
    });
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
  const { public: { EnableTrace } } = useRuntimeConfig()

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
  try { EnableTrace && umTrackEvent('csv') } catch { }

  fetch('/api/latestCollectionsMap')
    .then(resp => resp.json())
    .then(data => {
      const result = data as ApiResponse<CollectionCSVData>
      if (result.code !== 0 || !result.data) {

        toast.add({
          title: '加载失败',
          description: `错误信息: ${result.message}`,
          icon: 'i-mdi-exclamation-thick',
          color: 'error'
        })
        return
      }
      const parsedCSV1wPlus = Papa.parse<{ act_id: string; act_title: string }>(result.data['100000+'], {
        header: true,
        skipEmptyLines: true,
      }).data as CSVDefinition[];
      const parsedCSV100to300 = Papa.parse<{ act_id: string; act_title: string }>(result.data['100-300'], {
        header: true,
        skipEmptyLines: true,
      }).data as CSVDefinition[];
      loadedCollectionIDs.value = [...parsedCSV100to300, ...parsedCSV1wPlus.filter(item => item.status.toLowerCase() === "true")].map(item => ({
        act_id: item.act_id,
        act_title: item.act_title
      }))

      toast.add({
        title: '加载成功, 共 ' + loadedCollectionIDs.value.length + ' 条数据',
        description: '请从下拉菜单中选择收藏集',
        icon: 'i-mdi-check-bold',
        color: 'success',
      })
    }).catch(() => {

      toast.add({
        title: '加载失败',
        description: '请稍后重试',
        icon: 'i-mdi-exclamation-thick',
        color: 'error'
      })
    }).finally(() => { loadingCSV.value = false })
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
  <UCard variant="subtle">
    <template #header>
      <h1 class="text-2xl font-semibold">关键词搜索或二维码识别</h1>
    </template>
    <div>
      <div class="flex justify-center-safe">
        <UTabs :items="tabItems" class="w-full max-w-10/12 flex-col" :orientation="tabOrientation" :ui="{
          list: 'w-full'
        }">
          <template #search>
            <Transition name="opacity" mode="out-in" appear>
              <div key="search">
                <form class="flex justify-center-safe mt-1"
                  @submit.prevent="searchForKeyword(searchKeyword, 1); searchPage = 1;">
                  <UInput v-model="searchKeyword" class="w-11/12" type="search" icon="i-mdi-magnify" size="lg"
                    variant="outline" placeholder="Search..." />
                  <UButton class="ml-2 w-9 flex justify-center" icon="i-mdi-magnify" size="md" color="primary"
                    variant="soft" type="submit" />
                </form>
                <USeparator class="mt-4 mb-2" size="md" />
                <div v-if="searchItems.length !== 0">
                  <UPageGrid>
                    <TransitionGroup name="suit-card" mode="out-in" appear>
                      <UPageCard v-for="searchItem in searchItems" :key="searchItem.name" variant="outline_nopadding"
                        class="flex justify-center-safe bg-default ring ring-default"
                        @click="updateResult(searchItem.type === 0 ? ParsedType.DLC : ParsedType.THEME, searchItem.id.toString())">
                        <div class="flex flex-nowrap items-center suit-card h-full">
                          <img :src="`/api/bili/proxy?origin=${encodeURIComponent(searchItem.cover)}`"
                            :alt="searchItem.id.toString()" class=" max-w-1/3 h-max">
                          <div class="relative flex items-center pl-2 pr-2" style="width:100%; height:100%;">
                            <div class="absolute inset-0 background-blur" :style="{
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
                  <UButton class="mt-2 w-full justify-center " icon="i-ic-refresh"
                    @click="searchForKeyword(searchKeyword, searchPage + 1); searchPage++;">加载更多
                  </UButton>
                </div>
                <USeparator v-else class="pt-4" label="还没有数据哦" size="lg" />
              </div>
            </Transition>
          </template>
          <template #qrcode>
            <Transition name="opacity" mode="out-in" appear>
              <div key="qrcode" class="flex justify-center-safe mt-1">
                <UButton class="text-center" icon="i-mdi-qrcode-scan" size="lg" color="primary" variant="soft"
                  @click="QRScan?.click()">
                  选择二维码
                </UButton>
                <input ref="QRScan" type="file" accept="image/*" class="absolute w-0 h-0 overflow-hidden"
                  @change="parseQRCode">
              </div>
            </Transition>
          </template>
          <template #idsearch>
            <Transition name="opacity" mode="out-in" appear>
              <div key="idsearch" class="flex flex-col items-center mt-1">
                <p class="mb-4 text-center">如果你无法通过关键词搜索到你想要的收藏集, 可以尝试直接输入其名称</p>
                <div class="mb-4 flex items-center-safe w-full justify-center-safe">
                  <UButton class="mr-2" @click="loadCSV()">加载CSV数据</UButton>
                  <USelectMenu icon="i-mdi-alpha-a-box" class="w-1/2" placeholder="请输入收藏集名称" value-key="act_id"
                    label-key="act_title" :items="loadedCollectionIDs" virtualize v-model="CSVSelectedID"
                    @change.stop="updateResult(ParsedType.DLC, CSVSelectedID)">
                    <template #item-label="{ item }">
                      {{ item.act_title }}
                      <span class="text-muted">
                        {{ item.act_id }}
                      </span>
                    </template>
                  </USelectMenu>
                </div>
                <p>鸣谢: <a style="text-decoration: underline;"
                    href="https://github.com/CaleyGoldue/bilibili-collections-archive" target="_blank"
                    rel="noopener noreferrer">CloudyEagle, CaleyGoldue</a></p>
              </div>
            </Transition>
          </template>
        </UTabs>
      </div>
    </div>
    <template #footer>
      <div class="flex justify-center-safe items-center-safe gap-1 min-h-9 flex-wrap">
        <USelect v-model="ParsedResult.type" icon="i-material-symbols-category" class="w-32 max-sm:grow" value-key="id"
          :items="selectItem" />
        <UInput v-model="ParsedResult.id" icon="i-mdi-identifier" class="w-64 max-sm:grow" placeholder="id" />
        <UButton trailing-icon="i-ic-arrow-forward" size="md" variant="outline" color="secondary"
          class="w-full sm:w-auto text-nowrap" @click="switchToDetailPage">下一步
        </UButton>
      </div>
    </template>
  </UCard>
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