<script setup lang="ts">
import { ref, watch } from 'vue';
import { Downloader, DownloadTask } from '~/utils/downloader/manager';
import type { DownloadItem } from '~/utils/downloader/types';

const ParallelDownloads = ref(4);
const SingleDownloadThread = ref(4);

const props = defineProps<{
    open: boolean;
    targetFiles: Array<{ url: string; filename: string }>
}>();

const emit = defineEmits<{ close: [boolean] }>()

const step = ref(1);

// 每次对话框打开时重设步骤为 1
watch(() => props.open, (v) => {
    if (v) step.value = 1;
});

var downloader = ref<Downloader | null>(null);
</script>

<template>
    <UModal v-bind:open="open" :ui="{ footer: 'justify-end' }">
        <template #header>
            <div class="text-lg md:text-xl font-bold">下载选项</div>
        </template>

        <template #body>
            <template v-if="step === 1">
                <div class="mb-2">下载选项</div>
                <USeparator size="md"></USeparator>
                <div class="grid grid-cols-2 gap-x-6 md:gap-y-1 gap-y-4 items-center mb-4 mt-2">
                    <div class="text-left pl-2 text-nowrap">最大并行下载任务数</div>
                    <UInputNumber v-model="ParallelDownloads" :min="1" :max="8" :step="1" />

                    <div class="text-left pl-2 text-nowrap">单任务下载线程数</div>
                    <UInputNumber v-model="SingleDownloadThread" :min="1" :max="6" :step="1" />
                </div>
            </template>
            <template v-else>
                <div class="mb-2">下载进度</div>
                <USeparator size="md" />
                <div class="mt-2"></div>
            </template>
        </template>

        <template #footer>
            <UButton label="取消" color="neutral" variant="outline" @click="() => {
                emit('close', false)
                if (step === 2 && downloader) {
                    downloader.cancelAllDownloads();
                }
            }" />
            <UButton :label="step === 1 ? '下一步' : '保存'" color="neutral" @click="() => {
                console.log(targetFiles)
                if (step === 1) {
                    if (downloader) {
                        downloader.cancelAllDownloads();
                    }
                    downloader = new Downloader({
                        maxConcurrentDownloads: ParallelDownloads,
                        taskOptions: {
                            maxThreads: SingleDownloadThread,
                            chunkSize: 5 * 1024 * 1024, // 5 MB
                        }
                    });
                    targetFiles.forEach(file => {
                        if (!downloader) {
                            return
                        }
                        downloader.addDownload({
                            Url: `/api/bili/proxy?origin=${encodeURIComponent(file.url)}`,
                            RelativePath: file.filename,
                            OnProgress: (loaded: number, total: number) => {
                                console.log(`Downloading ${file.filename}: ${loaded / total * 100}%`);
                            }
                        } as DownloadItem);
                    });
                    step = 2;
                } else {
                    emit('close', true);
                }
            }" />
        </template>
    </UModal>
</template>