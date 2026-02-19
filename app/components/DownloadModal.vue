<script setup lang="ts">
import { Parser } from '@heartalborada-del/svga';
import JSZip from 'jszip';
import { ref, watch } from 'vue';
import { Downloader } from '~/utils/downloader/manager';
import type { DownloadItem } from '~/utils/downloader/types';
import { ItemType } from '~~/types/api/enum';
import type { DownloadMetaData } from '~~/types/api/inner/types';

const ParallelDownloads = ref(4);
const SingleDownloadThread = ref(4);

const props = defineProps<{
    open: boolean;
    fileMetadatas: DownloadMetaData[]
}>();

const emit = defineEmits<{ close: [boolean] }>()

const step = ref(1);

// 每次对话框打开时重设步骤为 1
watch(() => props.open, (v) => {
    if (v) step.value = 1;
});

var downloader = ref<Downloader | null>(null);

const downloadProgress = ref<Map<string, number>>(new Map());
const downloadData = ref<Map<string, Blob>>(new Map());
const downloadUrls = ref<Map<string, string>>(new Map());

function save() {
    const zip = new JSZip()
    downloadData.value.forEach((data, filename) => {
        zip.file(filename, data);
    });
    zip.generateAsync({ type: 'blob' }).then((content) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `${FormatDateWithDefaultOffset(new Date(), '', true)}.zip`;
        link.click();
        URL.revokeObjectURL(link.href);
    });
}

function isAllDownloadsCompleted(): boolean {
    for (const progress of downloadProgress.value.values()) {
        if (progress !== 100 && progress !== -1) {
            return false;
        }
    }
    return true;
}
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
                <div class="mb-2">
                    下载进度 总数: {{ fileMetadatas.length }} /
                    完成: {{[...downloadProgress.values()].filter(v => v === 100).length}} /
                    失败: {{[...downloadProgress.values()].filter(v => v === -1).length}}
                </div>

                <USeparator size="md" />
                <div class="mt-2">
                    <div v-for="file in fileMetadatas" :key="file.filename" class="mb-4">
                        <div class="flex items-center mb-1">
                            <UBadge color="secondary" variant="outline">{{ ItemType.toString(file.type) }}</UBadge>
                            <div class="mb-1 ml-2">{{ file.name }}</div>
                        </div>
                        <UProgress
                            :model-value="(downloadProgress.get(file.filename) || 0) >= 0 ? (downloadProgress.get(file.filename) || 0) : 100"
                            :max="100" :label="`${(downloadProgress.get(file.filename) || 0)}%`" size="sm"
                            :color="(downloadProgress.get(file.filename) || 0) > 0 ? ((downloadProgress.get(file.filename) || 0) === 100 ? 'success' : 'info') : 'error'" />
                    </div>
                </div>
            </template>
        </template>

        <template #footer>
            <UButton label="取消" color="neutral" variant="outline" @click="() => {
                emit('close', false)
                if (step === 2 && downloader) {
                    downloader.cancelAllDownloads();
                }
                downloadData.clear();
                downloadUrls.clear();
            }" />
            <UButton :label="step === 1 ? '下一步' : '保存'" color="neutral"
                :disabled="step === 2 && !isAllDownloadsCompleted()" @click="() => {
                    if (step === 1) {
                        downloadProgress.clear();
                        downloadData.clear();
                        downloadUrls.clear();
                        if (downloader) {
                            downloader.cancelAllDownloads();
                        }
                        const { public: { isEdgeOneCompatible } } = useRuntimeConfig()
                        downloader = new Downloader({
                            maxConcurrentDownloads: ParallelDownloads,
                            taskOptions: {
                                maxThreads: SingleDownloadThread,
                                chunkSize: 5 * 1024 * 1024, // 5 MB
                                EdgeOneCompatible: isEdgeOneCompatible ? true : false,
                            }
                        });
                        fileMetadatas.forEach(async file => {
                            if (!downloader) {
                                return
                            }
                            downloadProgress.set(file.filename, 0);
                            // 保存数据
                            if (file.type === ItemType.SVGA) {
                                // SVGA 文件特殊处理
                                const parser = new Parser();
                                downloadProgress.set(file.filename, 5);
                                let video = await parser.load(file.url);
                                downloadProgress.set(file.filename, 20);
                                const apng = await new SVGAConverter(video).convertToAPNG()
                                downloadData.set(file.filename, apng);
                                downloadProgress.set(file.filename, 100);
                            } else {
                                downloader.addDownload({
                                    Url: `/api/bili/proxy?origin=${encodeURIComponent(file.url)}`,
                                    OnProgress: (loaded: number, total: number) => {
                                        downloadProgress.set(file.filename, Math.floor(loaded / total * 100));
                                    },
                                    OnFailed: (error: any) => {
                                        console.error(`Download failed for ${file.filename}:`, error);
                                        downloadProgress.set(file.filename, -1);
                                    },
                                    OnSuccess: async (data: Blob) => {
                                        downloadProgress.set(file.filename, 100);
                                        downloadData.set(file.filename, data);
                                    },
                                } as DownloadItem);
                            }
                        });
                        step = 2;
                        downloader.startDownloads();
                    } else {
                        if (!isAllDownloadsCompleted()) {
                            return;
                        }
                        save();
                        emit('close', true);
                    }
                }" />
        </template>
    </UModal>
</template>