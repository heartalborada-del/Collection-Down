import { defineStore } from "pinia";
import "pinia-plugin-persistedstate";
import { CollectionCardDownloadType } from "~~/types/collection";

export const useDownloadSettingStore = defineStore('downloadSetting', {
    state: () => ({
        maxParallelDownloads: 4,
        maxSingleDownloadThreads: 4,
        collectionDownloadTypes: [
            CollectionCardDownloadType.Image,
            CollectionCardDownloadType.Video
        ]
    }),
    persist: import.meta.client
        ? {
            key: 'downloadSetting',
            storage: localStorage,
        }
        : false,
});