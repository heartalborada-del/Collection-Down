import * as https from "node:https";

type HostResult = {
  host: string;
  result: number;
};

const UPOSURLS = [
  "https://upos-sz-mirrorbos.bilivideo.com",
  "https://upos-sz-mirrorcos.bilivideo.com",
  "https://upos-sz-mirrorcosb.bilivideo.com",
  "https://upos-sz-mirrorcoso1.bilivideo.com",
  "https://upos-sz-mirrorhw.bilivideo.com",
  "https://upos-sz-mirrorhwb.bilivideo.com",
  "https://upos-sz-mirrorhwo1.bilivideo.com",
  "https://upos-sz-mirror08c.bilivideo.com",
  "https://upos-sz-mirror08h.bilivideo.com",
  "https://upos-sz-mirror08ct.bilivideo.com",
  "https://upos-sz-mirrorali.bilivideo.com",
  "https://upos-sz-mirroralib.bilivideo.com",
  "https://upos-sz-mirroralio1.bilivideo.com",
  "https://upos-hz-mirrorakam.akamaized.net",
  "https://upos-sz-mirroraliov.bilivideo.com",
  "https://upos-tf-all-hw.bilivideo.com",
  "https://upos-tf-all-tx.bilivideo.com"
]
async function optimizeUPOS() {
  let result = await Promise.all(UPOSURLS.map( link => new Promise<HostResult>((resolve, reject) => {
    const start = performance.now()
    const req = https.get(link,{
      method: 'GET'
    }, (res) => {
      res.on('data', (chunk) => {
      });

      res.on('end', () => {
        const end = performance.now();
        const timeTaken = end - start;
        resolve({
          host: link,
          result: timeTaken
        })
      });
    })
    req.setTimeout(1000, () => {
      req.destroy();
      resolve({
        host: link,
        result: -1
      })
    });

    // 错误处理
    req.on('error', (err) => {
      resolve({
        host: link,
        result: -1
      })
    });
    req.end()
  })))
  const validResults = result.filter(d => d.result !== -1);
  if (validResults.length > 0) {
    validResults.sort((a, b) => a.result - b.result);
    return `${validResults[0].host}/**`;
  } else {
    return "https://upos-sz-mirrorali.bilivideo.com/**";
  }
}

export default async () => {
  let UPOS = await optimizeUPOS()
  console.info("Target UPOS URL: %s",UPOS)
  return defineNuxtConfig({
    runtimeConfig: {
      public: {
        UPOS: UPOS.replace("/**","")
      }
    },
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
          to: UPOS,
          fetchOptions: {
            headers: {
              'referer': 'https://www.bilibili.com/',
              'host': 'www.bilibili.com',
              'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
            },
          },
        },
        headers: {
          'Target': UPOS.replace("https://","").replace("/**","")
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
}