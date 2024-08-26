export const useStore = defineStore('main', {
    state: () => {
        return {
            tour: {} as Record<string, boolean>,
        }
    },
    persist: {
        storage: persistedState.localStorage,
    },
})