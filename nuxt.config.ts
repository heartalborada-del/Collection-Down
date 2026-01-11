// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    modules: ['@nuxt/eslint', '@nuxt/ui'],
    css: ['~/assets/css/global.css'],
    ui: {
        fonts: false,
    },
    runtimeConfig: {
        public: {
            GithubRawEndpoint: process.env.GITHUB_RAW_ENDPOINT || 'https://raw.githubusercontent.com',
        }
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
        vercel: {
            functions: {
                maxDuration: 60,
                memory: 512,
            }
        },
    }
})