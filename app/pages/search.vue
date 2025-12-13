<script setup lang="ts">
import QrcodeDecoder from "qrcode-decoder";
import { GetForwardedLink, ParsedType, ParseIdFromLink } from "~/utils/Preprocess";
import type { SuitSearchInfo } from "~~/types/api/inner/types";
import type { ApiResponse } from "~~/types/api/root";
import { Mutex } from "mutex-ts";
import type { SelectItem, TabsItem } from "@nuxt/ui";

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
    icon: 'i-mdi-help-circle',
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
const searchItems = ref<SuitSearchInfo[]>([])

const searchLock = new Mutex()

function parseQRCode(e: Event) {
  if (!(e.target instanceof HTMLInputElement && e.target === QRScan.value && QRScan.value?.files?.length && QRScan.value?.files?.length > 0)) return
  const file = e.target?.files?.[0]
  if (!file) return
  const URI = window.webkitURL.createObjectURL(file) || window.URL.createObjectURL(file)
  const qr = new QrcodeDecoder()
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
  const unlock = await searchLock.obtain()
  if (page < 1) {
    page = 1
  }
  if (page === 1) {
    searchItems.value = []
  }
  if (keyword.trim().length === 0) {
    unlock()
    return toast.add({
      title: '请输入搜索关键词',
      icon: 'i-mdi-exclamation-thick',
      color: 'warning'
    })
  }
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
    .then(data => data as ApiResponse<SuitSearchInfo[]>)
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
      unlock()
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
  toast.add({
    title: '解析成功',
    description: '点击下一步继续。',
    icon: 'i-mdi-check-bold',
    color: 'success',
  })
}
</script>

<template>
  <UCard variant="subtle">
    <template #header>
      <h1 class="text-2xl font-semibold">关键词搜索或二维码识别</h1>
    </template>
    <div>
      <div class="flex justify-center-safe">
        <UTabs :items="tabItems" class="w-full max-w-10/12">
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
        </UTabs>
      </div>
    </div>
    <template #footer>
      <div class="flex justify-center-safe">
        <USelect v-model="ParsedResult.type" icon="i-material-symbols-category" class="w-32" value-key="id"
          :items="selectItem" />
        <UInput v-model="ParsedResult.id" icon="i-mdi-identifier" class="w-64 ml-4 mr-4" placeholder="id" />
        <UButton trailing-icon="i-ic-arrow-forward" size="md" variant="outline" color="secondary"
          @click="switchToDetailPage">下一步
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