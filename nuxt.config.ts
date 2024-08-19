import type { ProxyServerOptions } from "httpxy";

const proxy: ProxyServerOptions  = {
  changeOrigin: true,
  headers: {
    'referer': 'https://www.bilibili.com/',
    'host': 'www.bilibili.com',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
  },
  xfwd: false,
  autoRewrite: true,
  selfHandleResponse: true,
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  modules: [
    '@nuxtjs/i18n'
  ],
  routeRules: {
    "/bili/api/**": {
      proxy: {
        to: "https://api.bilibili.com/x/**",
        fetchOptions: {
          ignoreResponseError: true,
          headers: {
            'referer': 'https://www.bilibili.com/',
            'host': 'www.bilibili.com',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
          },
        },
      },
      cors: true,
    },
    "/bili/i0/**": {
      proxy: {
        to: "https://i0.hdslb.com/**",
        fetchOptions: {
          ignoreResponseError: true,
          headers: {
            'referer': 'https://www.bilibili.com/',
            'host': 'www.bilibili.com',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
          },
        }
      },
      swr: 60*60,
      cors: true,
    },
    "/bili/upos/**": {
      proxy: {
        to: "https://upos-sz-mirrorali.bilivideo.com/**",
        fetchOptions: {
          headers: {
            'referer': 'https://www.bilibili.com/',
            'host': 'www.bilibili.com',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
          },
        },
      },
      swr: 60*15,
      cors: true,
    },
  },
  i18n: {
    //vueI18n: '@i18n.config.ts',
  },
  devtools: { enabled: true },
  vue: {
    compilerOptions: {
      isCustomElement: (tag) => tag.startsWith('mdui-')
    }
  },
  components: [
    {
      path: '~/components',
      pathPrefix: false
    }
  ],
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
            href: "https://fonts.font.im/icon?family=Material+Icons"
          },
      ],
      bodyAttrs: {
        class: 'mdui-theme-auto'
      }
    }
  }
})
