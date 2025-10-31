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
    }
  ])
</script>
<template>
  <UApp>
    <UHeader>
      <template #title>
        Collection Down
      </template>
      <UNavigationMenu :items="navigationItems" />
      <template #right>
        <UColorModeButton />

        <UTooltip text="Open on GitHub">
          <UButton
              color="neutral"
              variant="ghost"
              to="https://github.com/nuxt/ui"
              target="_blank"
              icon="i-simple-icons-github"
              aria-label="GitHub"
          />
        </UTooltip>
      </template>
    </UHeader>

    <UMain>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UMain>

    <UFooter />
  </UApp>
</template>