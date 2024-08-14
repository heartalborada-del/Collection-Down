// https://nuxt.com/docs/api/configuration/nuxt-config
import vue from '@vitejs/plugin-vue'

export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  modules: [
      '@nuxtjs/i18n'
  ],
  i18n: {
    //vueI18n: '@i18n.config.ts',
  },
  devtools: { enabled: true },
  vue: {
    compilerOptions: {
      isCustomElement: (tag) => tag.startsWith('mdui-')
    }
  },
  app: {
    head: {
      title: "Collection Down",
      meta:[
        {
          charset: "utf-8"
        },
        {
          name: "viewport",
          content: "width=device-width,initial-scale=1.0,maximum-scale=1.0,minimum-scale=1.0,user-scalable=no"
        }
      ],
      link:[
          {
            rel: "stylesheet",
            href: "https://fonts.googleapis.com/icon?family=Material+Icons"
          },
      ],
      bodyAttrs: {
        class: 'mdui-theme-auto'
      }
    }
  }
})
