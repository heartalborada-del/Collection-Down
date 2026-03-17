<script setup lang="ts">
import { Parser } from '@heartalborada-del/svga';
import JSZip from 'jszip';
import { computed, ref, watch } from 'vue';
import { useDownloadSettingStore } from '~/store/downloadSetting';
import { Downloader } from '~/utils/downloader/manager';
import type { DownloadItem } from '~/utils/downloader/types';
import { ItemType } from '~~/types/api/enum';
import type { DownloadMetaData } from '~~/types/api/inner/types';
import { CollectionCardDownloadType } from '~~/types/collection';

const store = useDownloadSettingStore();

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

const downloader = ref<Downloader | null>(null);

const downloadProgress = ref<Map<string, number>>(new Map());
const downloadData = ref<Map<string, Blob>>(new Map());
const downloadUrls = ref<Map<string, string>>(new Map());

/**
 * 判断当前文件是否应被纳入下载列表。
 */
function shouldIncludeInFileList(file: DownloadMetaData): boolean {
    if (!ItemType.isCard(file.type)) {
        return true;
    }

    if (file.type === ItemType.StaticCard) {
        return store.collectionDownloadTypes.includes(CollectionCardDownloadType.Image);
    }
    if (file.type === ItemType.StaticCardWatermarked) {
        return store.collectionDownloadTypes.includes(CollectionCardDownloadType.ImageWatermarked);
    }
    if (file.type === ItemType.AnimatedCard) {
        return store.collectionDownloadTypes.includes(CollectionCardDownloadType.Video);
    }
    if (file.type === ItemType.AnimatedCardWatermarked) {
        return store.collectionDownloadTypes.includes(CollectionCardDownloadType.VideoWatermarked);
    }

    return true;
}

/**
 * 重新构造后的最终下载列表：
 * - 进度展示使用它
 * - 实际下载入队使用它
 */
const fileList = computed(() => props.fileMetadatas.filter(shouldIncludeInFileList));

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

const LOTTIE_COMMENT = new Blob([`这是一个播放图标的 Lottie 文件，通常用于动态效果展示。请使用支持 Lottie 格式的工具或库来查看和使用此文件。`], { type: 'text/plain' });

</script>

<template>
    <UModal v-bind:open="open" :ui="{ footer: 'justify-end' }">
        <template #header>
            <div class="text-lg md:text-xl font-bold" v-if="step === 1">下载选项</div>
            <div class="text-lg md:text-xl font-bold" v-if="step === 2">下载进度</div>
        </template>

        <template #body>
            <template v-if="step === 1">
                <div class="mb-2">下载选项</div>
                <USeparator size="md"/>
                <div class="grid grid-cols-2 gap-x-6 md:gap-y-1 gap-y-4 items-center mb-4 mt-2">
                    <div class="text-left pl-2 text-nowrap">最大并行下载任务数</div>
                    <UInputNumber v-model="store.maxParallelDownloads" :min="1" :max="16" :step="1" />
                    <div class="text-left pl-2 text-nowrap">单任务下载线程数</div>
                    <UInputNumber v-model="store.maxSingleDownloadThreads" :min="1" :max="8" :step="1" />
                </div>
                <div class="mb-2">
                    收藏集下载类型设置
                </div>
                <USeparator size="md"/>
                <USelect multiple :items="[
                    {
                        label: '视频',
                        value: CollectionCardDownloadType.Video
                    },
                    {
                        label: '视频（带水印）',
                        value: CollectionCardDownloadType.VideoWatermarked
                    },
                    {
                        label: '图片',
                        value: CollectionCardDownloadType.Image
                    },
                    {
                        label: '图片（带水印）',
                        value: CollectionCardDownloadType.ImageWatermarked
                    }
                ]" v-model="store.collectionDownloadTypes" value-key="value" placeholder="选择收藏集下载类型"
                    class="items-center mb-4 mt-2 w-full">
                </USelect>
            </template>
            <template v-else>
                <div class="mb-2">
                    下载进度 总数: {{ fileList.length }} /
                    完成: {{[...downloadProgress.values()].filter(v => v === 100).length}} /
                    失败: {{[...downloadProgress.values()].filter(v => v === -1).length}}
                </div>

                <USeparator size="md" />
                <div class="mt-2">
                    <div v-for="file in fileList" :key="file.filename" class="mb-4">
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
                            maxConcurrentDownloads: store.maxParallelDownloads,
                            taskOptions: {
                                maxThreads: store.maxSingleDownloadThreads,
                                chunkSize: 1 * 1024 * 1024, // 1 MB
                                EdgeOneCompatible: isEdgeOneCompatible ? true : false,
                            }
                        });
                        fileList.forEach(async file => {
                            if (!downloader) {
                                return
                            }
                            // 保存数据
                            if (file.type === ItemType.SVGA) {
                                downloadProgress.set(file.filename, 0);
                                // SVGA 文件特殊处理
                                const parser = new Parser();
                                downloadProgress.set(file.filename, 5);
                                let video = await parser.load(file.url);
                                downloadProgress.set(file.filename, 20);
                                const apng = await new SVGAConverter(video).convertToAPNG()
                                downloadData.set(file.filename, apng);
                                downloadProgress.set(file.filename, 100);
                            } else {
                                if (file.type === ItemType.PlayIconLottie) {
                                    //获取目录
                                    const dir = file.filename.split('/').slice(0, -1).join('/');
                                    downloadData.set(`${dir}/readme.txt`, LOTTIE_COMMENT);
                                }
                                downloadProgress.set(file.filename, 0);
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