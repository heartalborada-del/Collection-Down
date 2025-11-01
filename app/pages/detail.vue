<script setup lang="ts">
import {ParsedType} from "~/utils/parser";
import type {SelectItem} from "#ui/components/Select.vue";
import type {ApiResponse} from "~~/types/api/root";
import type {LotteryListItem} from "~~/types/api/bili/types";
import {Mutex} from "mutex-ts";
import type {CardInfo, RedeemInfo} from "~~/types/api/inner/types";

const route = useRoute()
const router = useRouter();
const toast = useToast()

const ParsedResult: Ref<{ type: ParsedType; id: string }> = ref({type: ParsedType.NONE, id: ''})

const ItemsArray = ref<{
  id: number
  name: string
  cards: CardInfo[]
}[]>([])
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
const selected = ref<{
  id: number
  name?: string
  cards: CardInfo[]
}>({
  id: 0,
  cards: []
})

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
}, {deep: true, immediate: true})

async function fetchData() {
  if (ParsedResult.value.type === ParsedType.DLC) {
    ItemsArray.value = []
    selected.value = {
      id: 0,
      cards: []
    }
    const unlock = await lock.obtain()
    fetch(`/api/bili/collection/allLotteryId?act_id=${ParsedResult.value.id}`)
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
        .then(data => data as ApiResponse<LotteryListItem[]>)
        .then(async result => {
          if (result.code !== 0 || !result.data) {
            toast.add({
              title: '搜索时出现错误',
              description: `错误信息：${result.message}`,
              icon: 'i-mdi-exclamation-thick',
              color: 'error'
            })
            throw "skip"
          }
          const promises = result.data.map(item => {
            return fetch(`/api/bili/collection/collectLootInfo?act_id=${ParsedResult.value.id}&lottery_id=${item.lottery_id}`)
                .then(response => response.json())
                .then(data => data as ApiResponse<{
                  items: CardInfo[],
                  redeems: RedeemInfo[],
                }>)
                .then(res => {
                  if (res.code !== 0 || !res.data) {
                    toast.add({
                      title: '搜索时出现错误',
                      description: `错误信息：${res.message}`,
                      icon: 'i-mdi-exclamation-thick',
                      color: 'error'
                    })
                  }
                  toast.add({
                    title: `获取 ${item.lottery_name} 成功`,
                    description: `获得 ${res.data?.items.length} 张卡片，${res.data?.redeems.length} 个兑换码`,
                    icon: 'i-mdi-check-circle',
                    color: 'success'
                  })
                  return {
                    id: item.lottery_id,
                    name: item.lottery_name,
                    cards: res.data?.items,
                  }
                })
                .catch(error => {
                  toast.add({
                    title: '搜索时出现错误',
                    description: '请稍后重试。',
                    icon: 'i-mdi-exclamation-thick',
                    color: 'error'
                  })
                  console.error(error)
                })
          })
          const merged = await Promise.all(promises);
          ItemsArray.value = []
          selected.value = {
            id: 0,
            cards: []
          }
          merged.forEach(item => {
            if (item!.cards)
              ItemsArray.value.push({
                id: item!.id,
                name: item!.name,
                cards: item!.cards
              })
          });
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
}

async function showCardDetail() {

}
</script>

<template>
  <div>
    <div class="flex justify-center-safe">
      <USelect
          v-model="ParsedResult.type" icon="i-material-symbols-category" class="w-32" value-key="id"
          :items="selectItem"/>
      <UInput v-model="ParsedResult.id" icon="i-mdi-identifier" class="w-64 ml-4 mr-4" placeholder="id"/>
      <UButton trailing-icon="i-ic-arrow-forward" size="md" variant="outline" color="secondary" @click="fetchData">
        获取数据
      </UButton>
    </div>
    <USeparator class="m-2" size="md"/>
    <div class="flex justify-center-safe">
      <USelectMenu v-model="selected" class="w-9/12 min-w-40" label-key="name" :items="ItemsArray" @change="showCardDetail()"/>
    </div>
    <div v-if="selected.id !== 0">
      <div class="flex justify-center-safe align-items-center flex-wrap">
        <UPageCard
            v-for="card in selected.cards"
            :key="card.id"
            variant="outline_nopadding"
            class="flex justify-center-safe bg-default ring ring-default"
            style="width: 100%;height: 100%;"
        >
          <img style="object-fit: cover;height: 100%;" :src="`/api/bili/proxy?origin=${encodeURIComponent(card.img)}`" :alt="card.name" class=" max-w-1/3 h-max">
        </UPageCard>
      </div>
      <!--      <UPageGrid>
              <UPageCard
                  v-for="searchItem in searchItems"
                  :key="searchItem.name"
                  variant="outline_nopadding"
                  class="flex justify-center-safe bg-default ring ring-default"
                  @click="updateResult(searchItem.type === 0 ? ParsedType.DLC : ParsedType.THEME, searchItem.id.toString())"
              >
                <div class="flex flex-nowrap items-center suit-card h-full">
                  <img :src="`/api/bili/proxy?origin=${encodeURIComponent(searchItem.cover)}`"
                       :alt="searchItem.id.toString()" class=" max-w-1/3 h-max">
                  <div class="relative flex items-center pl-2 pr-2" style="width:100%; height:100%;">
                    <div
                        class="absolute inset-0 background-blur"
                        :style="{
                                backgroundImage: `url('/api/bili/proxy?origin=${encodeURIComponent(searchItem.cover)}')`,
                              }"
                        aria-hidden="true"
                    />
                    <div class="relative z-10 w-full">
                      <p class="text-center" style="width: 100%;">{{ searchItem.name }}</p>
                    </div>
                  </div>
                </div>
              </UPageCard>
            </UPageGrid>-->
    </div>
    <USeparator v-else class="pt-4" label="还没有数据哦" size="lg"/>
  </div>
</template>

<style scoped>

</style>