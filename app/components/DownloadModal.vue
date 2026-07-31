<script setup lang="ts">
import { Parser } from '@heartalborada-del/svga';
import { computed, ref, watch } from 'vue';
import { useDownloadSettingStore } from '~/store/downloadSetting';
import { Downloader } from '~/utils/downloader/manager';
import { ItemType } from '~~/types/api/enum';
import type { DownloadMetaData } from '~~/types/api/inner/types';
import { CollectionCardDownloadType } from '~~/types/collection';
import { getErrorMessage } from '~/utils/apiError';

const store = useDownloadSettingStore();
const onboardingSteps = [
    {
        title: '并行下载数量',
        description: '控制同时下载的文件数；数值越高，带宽和内存占用越大。',
        icon: 'i-mdi-download-multiple',
        target: '[data-tour="download-parallel"]',
    },
    {
        title: '单文件线程数',
        description: '控制单个文件的分片并发数，网络不稳定时可以适当调低。',
        icon: 'i-mdi-call-split',
        target: '[data-tour="download-threads"]',
    },
    {
        title: '选择下载类型',
        description: '决定收藏集卡片需要包含视频、图片及其带水印版本。',
        icon: 'i-mdi-file-multiple-outline',
        target: '[data-tour="download-types"]',
    },
    {
        title: '取消下载',
        description: '取消会关闭面板；下载开始后还会终止当前任务和剩余队列。',
        icon: 'i-mdi-close-circle-outline',
        target: '[data-tour="download-cancel"]',
    },
    {
        title: '进入下载进度',
        description: '点击下一步开始处理文件，完成后同一按钮会变为保存。',
        icon: 'i-mdi-progress-download',
        target: '[data-tour="download-next"]',
    },
]

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
const downloadErrors = ref<Map<string, string>>(new Map());

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
const completedCount = computed(() => [...downloadProgress.value.values()].filter(value => value === 100).length);
const failedCount = computed(() => [...downloadProgress.value.values()].filter(value => value === -1).length);

async function save() {
    if (!downloader.value || !isAllDownloadsCompleted()) {
        return;
    }

    const content = await downloader.value.save();
    if (!content) return;
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(content);
    link.href = objectUrl;
    link.download = `${new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, '')}.zip`;
    link.click();
    URL.revokeObjectURL(objectUrl);
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

async function startDownload() {
    downloadProgress.value.clear();
    downloadErrors.value.clear();
    downloader.value?.cancelAllDownloads();
    downloader.value = new Downloader({
        maxConcurrentDownloads: store.maxParallelDownloads,
        taskOptions: {
            maxThreads: store.maxSingleDownloadThreads,
            chunkSize: 1024 * 1024,
        }
    });
    step.value = 2;

    const lottieReadmeDirectories = new Set<string>();
    for (const file of fileList.value) {
        const currentDownloader = downloader.value;
        if (!currentDownloader) return;
        downloadProgress.value.set(file.filename, 0);

        if (file.type === ItemType.SVGA) {
            try {
                const parser = new Parser();
                downloadProgress.value.set(file.filename, 5);
                const video = await parser.load(file.url);
                downloadProgress.value.set(file.filename, 20);
                const apng = await new SVGAConverter(video).convertToAPNG();
                await currentDownloader.addRawData(file.filename, apng);
                downloadProgress.value.set(file.filename, 100);
            } catch (error) {
                console.error(`SVGA conversion failed for ${file.filename}:`, error);
                downloadProgress.value.set(file.filename, -1);
                downloadErrors.value.set(file.filename, getErrorMessage(error, 'SVGA 转换失败'));
            }
            continue;
        }

        if (file.type === ItemType.PlayIconLottie) {
            const directory = file.filename.split('/').slice(0, -1).join('/');
            if (!lottieReadmeDirectories.has(directory)) {
                await currentDownloader.addRawData(`${directory}/readme.txt`, LOTTIE_COMMENT);
                lottieReadmeDirectories.add(directory);
            }
        }
        currentDownloader.addDownload({
            Url: `/api/bili/proxy?origin=${encodeURIComponent(file.url)}`,
            FileFullDirectory: file.filename,
            OnProgress: (loaded: number, total: number) => {
                downloadProgress.value.set(file.filename, Math.floor(loaded / total * 100));
            },
            OnFailed: (error: unknown) => {
                console.error(`Download failed for ${file.filename}:`, error);
                downloadProgress.value.set(file.filename, -1);
                downloadErrors.value.set(file.filename, getErrorMessage(error, '下载失败'));
            },
            OnSuccess: () => {
                downloadProgress.value.set(file.filename, 100);
            },
        });
    }

    await downloader.value.startDownloads();
}

</script>

<template>
  <div>
    <UModal :open="open" :ui="{ footer: 'justify-end' }">
        <template #header>
            <div v-if="step === 1" class="text-lg md:text-xl font-bold">下载选项</div>
            <div v-if="step === 2" class="text-lg md:text-xl font-bold">下载进度</div>
        </template>

        <template #body>
            <template v-if="step === 1">
                <div class="mb-2">下载选项</div>
                <USeparator size="md"/>
                <div class="grid grid-cols-2 gap-x-6 md:gap-y-1 gap-y-4 items-center mb-4 mt-2">
                    <div class="text-left pl-2 text-nowrap">最大并行下载任务数</div>
                    <UInputNumber v-model="store.maxParallelDownloads" data-tour="download-parallel" :min="1" :max="8" :step="1" />
                    <div class="text-left pl-2 text-nowrap">单任务下载线程数</div>
                    <UInputNumber v-model="store.maxSingleDownloadThreads" data-tour="download-threads" :min="1" :max="4" :step="1" />
                </div>
                <div class="mb-2">
                    收藏集下载类型设置
                </div>
                <USeparator size="md"/>
<USelect
v-model="store.collectionDownloadTypes" data-tour="download-types" multiple :items="[
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
                ]" value-key="value" placeholder="选择收藏集下载类型"
                    class="items-center mb-4 mt-2 w-full"/>
            </template>
            <template v-else>
                <div class="mb-2">
                    下载进度 总数: {{ fileList.length }} /
                    完成: {{ completedCount }} /
                    失败: {{ failedCount }}
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
                        <p v-if="downloadErrors.get(file.filename)" class="mt-1 text-sm text-error break-words">
                            {{ downloadErrors.get(file.filename) }}
                        </p>
                    </div>
                </div>
            </template>
        </template>

        <template #footer>
            <UButton
data-tour="download-cancel" label="取消" color="neutral" variant="outline" @click="() => {
                emit('close', false)
                if (step === 2 && downloader) {
                    downloader.cancelAllDownloads();
                }
            }" />
            <UButton
data-tour="download-next" :label="step === 1 ? '下一步' : '保存'" color="neutral"
                :disabled="(step === 1 && fileList.length === 0) || (step === 2 && !isAllDownloadsCompleted())" @click="() => {
                    if (step === 1) {
                        void startDownload();
                    } else {
                        if (!isAllDownloadsCompleted()) {
                            return;
                        }
                        void save();
                        emit('close', true);
                    }
                }" />
        </template>
    </UModal>
    <OnboardingTour v-if="open && step === 1" tour-id="download" :steps="onboardingSteps" />
  </div>
</template>
