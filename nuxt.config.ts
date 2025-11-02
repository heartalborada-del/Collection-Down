// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    devtools: { enabled: true },
    modules: ['@nuxt/eslint', '@nuxt/ui'],
    css: ['~/assets/css/global.css'],
    ui: {
        fonts: false,
    },
    devServer: {
        host: '127.0.0.1',
        port: 3000,
    },
    app: {
        pageTransition: { name: 'page', mode: 'out-in' },
    }
})