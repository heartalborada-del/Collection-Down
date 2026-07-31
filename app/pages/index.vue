<script setup lang="ts">
const onboardingSteps = [
  {
    title: '欢迎使用 Collection Down',
    description: '这里可以获取哔哩哔哩收藏集与主题资源。引导只会自动显示一次。',
    icon: 'i-mdi-download-box-outline',
    target: '[data-tour="home-intro"]',
  },
  {
    title: '切换工作页面',
    description: '从导航进入搜索或详情页；搜索适合查找资源，详情页用于选择并下载内容。',
    icon: 'i-mdi-navigation-variant-outline',
    target: '[data-tour="main-navigation"]',
  },
  {
    title: '切换明暗主题',
    description: '使用主题按钮在浅色、深色和系统外观之间切换。',
    icon: 'i-mdi-theme-light-dark',
    target: '[data-tour="color-mode"]',
  },
  {
    title: '重新查看引导',
    description: '需要回顾当前页面操作时，点击问号重新开始本页引导。',
    icon: 'i-mdi-help-circle-outline',
    target: '[data-tour="restart-guide"]',
  },
  {
    title: '查看项目源码',
    description: 'GitHub 入口包含项目源码、问题反馈和最新维护信息。',
    icon: 'i-simple-icons-github',
    target: '[data-tour="github-link"]',
  },
  {
    title: '镜像与项目信息',
    description: '下载速度异常时，可在项目说明中查看最新镜像站点和维护信息。',
    icon: 'i-mdi-source-repository',
    target: '[data-tour="home-mirrors"]',
  },
]
</script>

<template>
  <div data-tour="home-intro">
    <h1 class="font-bold text-3xl">这是什么项目</h1>
    <USeparator class="mt-1 mb-2" size="md" />
    <p class="leading-7">如你所见，这是一个适用于b站装扮以及收藏集下载的项目</p>
    <p class="leading-7">此项目旨在给予B站用户更好的站装扮以及收藏集下载体验</p>
    <div data-tour="home-mirrors">
      <USeparator class="mt-4 mb-2" size="md" />
      <h2 class="font-bold text-2xl">镜像站点</h2>
      <USeparator class="mt-1 mb-2" size="md" />
      <p style="font-weight: 800;">
        请查看
        <ULink style="text-decoration: underline;" href="https://github.com/heartalborada-del/Collection-Down">Github
          README.md</ULink>
        获取最新镜像站点信息
      </p>
    </div>
    <OnboardingTour tour-id="home" :steps="onboardingSteps" />
  </div>
</template>
