<script setup lang="ts">
import QrcodeDecoder from "qrcode-decoder";
import type {TabsItem} from "#ui/components/Tabs.vue";
import {GetForwardedLink, ParsedType, ParseIdFromLink} from "~/utils/parser";
import type {SelectItem} from "#ui/components/Select.vue";
import type {SuitSearchInfo} from "~~/types/api/inner/types";
import type {ApiResponse} from "~~/types/api/root";

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

let searchItems = ref<SuitSearchInfo[]>([])

function parseQRCode(e: Event) {
  if (! (e.target instanceof HTMLInputElement && e.target === QRScan.value && QRScan.value?.files?.length && QRScan.value?.files?.length > 0)) return
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
      toast.add({
        title: '二维码内容解析成功',
        icon: 'i-mdi-check-bold',
        color: 'success',
        duration: 1000
      })
      ParsedResult.value = parsed
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
    console.error(err)
  })
}

function searchForKeyword(keyword: string,page: number) {
  if (page < 1) {
    page = 1
  }
  if (page === 1) {
    searchItems.value = []
  }
  if (keyword.trim().length === 0) {
    return toast.add({
      title: '请输入搜索关键词',
      icon: 'i-mdi-exclamation-thick',
      color: 'warning'
    })
  }
  useFetch<ApiResponse<SuitSearchInfo[]>>('/api/bili/collection/search', {
    method: 'GET',
    params: {
      key_word: keyword,
      page: page
    }
  }).then(res => {
    if (res.data.value) {
      if (res.data.value.code) {
        return toast.add({
          title: '搜索时出现错误',
          description: res.data.value.message || '请稍后重试。',
          icon: 'i-mdi-exclamation-thick',
          color: 'error'
        })
      }
      searchItems.value = [...searchItems.value, ...res.data.value.data]
    } else {
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
    }
  }).catch(() => {
    toast.add({
      title: '搜索时出现错误',
      description: '请稍后重试。',
      icon: 'i-mdi-exclamation-thick',
      color: 'error'
    })
  })
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
            <form @submit.prevent="searchForKeyword(searchKeyword,1)" class="flex justify-center-safe mt-1">
              <UInput v-model="searchKeyword" class="w-11/12"  type="search" icon="i-mdi-magnify"  size="lg" variant="outline" placeholder="Search..." />
              <UButton class="ml-2 w-9 flex justify-center" icon="i-mdi-magnify" size="md" color="primary" variant="soft" type="submit" />
            </form>
            <USeparator class="mt-4 mb-2" size="md" />
            <UPageColumns>
              <UCard
                  v-for="searchItem in searchItems"
                  :key="searchItem.id"
                  variant="subtle"
                  :title="searchItem.name"
              />
            </UPageColumns>
          </template>
          <template #qrcode>
            <div class="flex justify-center-safe mt-1">
              <UButton class=" text-center" icon="i-mdi-qrcode-scan" size="lg" color="primary" variant="soft" @click="QRScan?.click()">
                选择二维码
              </UButton>
              <input ref="QRScan" type="file" accept="image/*" class="absolute w-0 h-0 overflow-hidden" @change="parseQRCode" />
            </div>
          </template>
        </UTabs>
      </div>
    </div>
    <template #footer>
      <div class="flex justify-center-safe">
        <USelect v-model="ParsedResult.type" icon="i-material-symbols-category" class="w-32" value-key="id" :items="selectItem" />
        <UInput v-model="ParsedResult.id" icon="i-mdi-identifier" class="w-64 ml-4 mr-4" placeholder="id" />
        <UButton trailing-icon="i-ic-arrow-forward" size="md" variant="outline" color="secondary" @click="switchToDetailPage">下一步</UButton>
      </div>
    </template>
  </UCard>
</template>

<style scoped>

</style>