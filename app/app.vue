<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const navigationItems = computed<NavigationMenuItem[]>(() => [
  {
    label: 'Home',
    icon: 'i-mdi-home',
    to: '/',
    active: route.path === '/',
  },
  {
    label: 'Search',
    icon: 'i-mdi-search',
    to: '/search',
    active: route.path === '/search',
  },
  {
    label: 'Detail',
    icon: 'i-mdi-information',
    to: '/detail',
    active: route.path === '/detail',
  }
])
</script>

<style>
.page-enter-active,
.page-leave-active {
  transition: all 0.1s;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
  filter: blur(1rem);
}
</style>

<template>
  <UApp>
    <UHeader mode="slideover">
      <template #title>
        Collection Down
      </template>
      <UNavigationMenu :items="navigationItems" />
      <template #right>
        <UColorModeButton />

        <UTooltip text="Open on GitHub">
          <UButton color="neutral" variant="ghost" to="https://github.com/heartalborada-del/Collection-Down"
            target="_blank" icon="i-simple-icons-github" aria-label="GitHub" />
        </UTooltip>
      </template>
      <template #body>
        <UNavigationMenu :items="navigationItems" orientation="vertical" class="-mx-2.5" />
      </template>
    </UHeader>

    <UMain>
      <NuxtLayout>
        <UContainer class="pt-4">
          <NuxtPage />
        </UContainer>
      </NuxtLayout>
    </UMain>

    <UFooter />
  </UApp>
</template>