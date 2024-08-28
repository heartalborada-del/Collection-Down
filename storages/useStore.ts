export const useStore = defineStore('main', {
    state: () => {
        return {
            tour: {} as Record<string, boolean>,
            settings: {
                download: {
                    parallelThread: 2,
                    segmentThread: 2
                }
            }
        }
    },
    persist: {
        storage: persistedState.localStorage,
    },
})