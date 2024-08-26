import {defineNuxtPlugin} from '#app'
import PortalVue from 'portal-vue'
import VueTour from 'vue3-tour'

export default defineNuxtPlugin((nuxtApp) => {
    nuxtApp.vueApp.use(PortalVue)
    nuxtApp.vueApp.use(VueTour)
})
