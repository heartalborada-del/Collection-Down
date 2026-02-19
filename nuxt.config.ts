// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    modules: ['@nuxt/eslint', '@nuxt/ui', 'nuxt-umami'],
    css: ['~/assets/css/global.css'],
    ui: {
        fonts: false,
    },
    runtimeConfig: {
        public: {
            GithubRawEndpoint: process.env.GITHUB_RAW_ENDPOINT || 'https://raw.githubusercontent.com',
            EnableTrace: process.env.UMAMI_ENABLED === 'true' || false,
            isEdgeOneCompatible: process.env.EDGE_ONE_COMPATIBLE === 'true' || false,
        },
        isDev: process.env.DEV_MODE === 'true' || false,
    },
    devServer: {
        host: '127.0.0.1',
        port: 3000,
    },
    app: {
        pageTransition: { name: 'page', mode: 'out-in' },
        head: {
            title: 'Collection Down',
            meta: [
                { name: 'viewport', content: 'width=device-width, initial-scale=1' },
                { charset: 'utf-8' },
                { name: 'description', content: 'A new bilibili collection downloader.' },
            ],
            link: [{ rel: 'icon', type: 'image/x-icon', href: './favicon.ico' }],
        },
    },
    nitro: {
        compressPublicAssets: true,
        vercel: {
            functions: {
                maxDuration: 60,
                memory: 512,
            }
        },
        cloudflare: {
            deployConfig: true,
            nodeCompat: true,
        },
        replace: {
            'typeof window': '`undefined`',
        },
    },
    umami: {
        enabled: process.env.UMAMI_ENABLED === 'true',
        host: process.env.UMAMI_HOST,
        id: process.env.UMAMI_ID,
        tag: process.env.UMAMI_TAG,
        ignoreLocalhost: true,
        autoTrack: true,
        urlOptions: {
            trailingSlash: "never",
        }
    }
})