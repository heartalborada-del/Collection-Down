<script setup lang="ts">
import { Parser } from '@heartalborada-del/svga';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useDownloadSettingStore } from '~/store/downloadSetting';
import { Downloader } from '~/utils/downloader/manager';
import { ItemType } from '~~/types/api/enum';
import type { DownloadMetaData } from '~~/types/api/inner/types';
import { CollectionCardDownloadType } from '~~/types/collection';
import { getErrorMessage } from '~/utils/apiError';

const store = useDownloadSettingStore();
const toast = useToast();
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
        description: '下载开始后，取消会终止当前任务和剩余队列。',
        icon: 'i-mdi-close-circle-outline',
        target: '[data-tour="download-cancel"]',
    },
    {
        title: '开始下载',
        description: '先刷新全部已选来源的链接，再处理文件并保存为压缩包。',
        icon: 'i-mdi-progress-download',
        target: '[data-tour="download-next"]',
    },
]

const props = defineProps<{
    open: boolean;
    fileMetadatas: DownloadMetaData[];
    refreshFileMetadatas?: () => Promise<DownloadMetaData[]>;
}>();

const emit = defineEmits<{ close: [boolean] }>()

const downloadTypeOptions = [
    {
        label: '视频',
        description: '动态卡片原始视频',
        value: String(CollectionCardDownloadType.Video),
        icon: 'i-mdi-video-outline'
    },
    {
        label: '带水印视频',
        description: '包含平台水印的视频版本',
        value: String(CollectionCardDownloadType.VideoWatermarked),
        icon: 'i-mdi-video-marker-outline'
    },
    {
        label: '图片',
        description: '静态卡片原图',
        value: String(CollectionCardDownloadType.Image),
        icon: 'i-mdi-image-outline'
    },
    {
        label: '带水印图片',
        description: '包含平台水印的图片版本',
        value: String(CollectionCardDownloadType.ImageWatermarked),
        icon: 'i-mdi-image-marker-outline'
    }
]

const selectedDownloadTypes = computed<string[]>({
    get: () => store.collectionDownloadTypes.map(value => String(value)),
    set: (values) => {
        store.collectionDownloadTypes = values.map(value => Number(value) as CollectionCardDownloadType);
    }
});

function getDownloadTypeIcon(item: unknown): string {
    return (item as { icon?: string }).icon ?? 'i-mdi-file-outline';
}

function getDownloadTypeLabel(item: unknown): string {
    return (item as { label?: string }).label ?? '';
}

const step = ref(1);
const downloader = ref<Downloader | null>(null);
const downloadProgress = ref<Map<string, number>>(new Map());
const downloadErrors = ref<Map<string, string>>(new Map());
const availableFiles = ref<DownloadMetaData[]>([]);
const refreshingLinks = ref(false);
const downloadRunning = ref(false);
const saving = ref(false);
let downloadRunId = 0;

watch([() => props.open, () => props.fileMetadatas], ([open, files]) => {
    if (open) {
        step.value = 1;
        saving.value = false;
        refreshingLinks.value = false;
        availableFiles.value = [...files];
    }
}, { immediate: true });

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

const fileList = computed(() => availableFiles.value.filter(shouldIncludeInFileList));
const completedCount = computed(() => fileList.value.filter(file => downloadProgress.value.get(file.filename) === 100).length);
const failedCount = computed(() => fileList.value.filter(file => downloadProgress.value.get(file.filename) === -1).length);
const activeCount = computed(() => fileList.value.filter((file) => {
    const progress = downloadProgress.value.get(file.filename) ?? 0;
    return progress > 0 && progress < 100;
}).length);
const pendingCount = computed(() => Math.max(0, fileList.value.length - completedCount.value - failedCount.value - activeCount.value));
const settledCount = computed(() => completedCount.value + failedCount.value);
const overallProgress = computed(() => {
    if (fileList.value.length === 0) return 0;
    const total = fileList.value.reduce((sum, file) => {
        const progress = downloadProgress.value.get(file.filename) ?? 0;
        return sum + (progress === -1 ? 100 : Math.min(100, Math.max(0, progress)));
    }, 0);
    return Math.round(total / fileList.value.length);
});
const allDownloadsCompleted = computed(() => fileList.value.length > 0 && fileList.value.every((file) => {
    const progress = downloadProgress.value.get(file.filename);
    return progress === 100 || progress === -1;
}));
const isDownloading = computed(() => step.value === 2 && downloadRunning.value);
const isBusy = computed(() => refreshingLinks.value || isDownloading.value || saving.value);
const overallProgressColor = computed<'info' | 'success' | 'warning'>(() => {
    if (!allDownloadsCompleted.value) return 'info';
    return failedCount.value > 0 ? 'warning' : 'success';
});

type DownloadFileStatus = 'pending' | 'active' | 'completed' | 'failed'

function getFileProgress(filename: string): number {
    return downloadProgress.value.get(filename) ?? 0;
}

function getFileStatus(filename: string): DownloadFileStatus {
    const progress = downloadProgress.value.get(filename);
    if (progress === -1) return 'failed';
    if (progress === 100) return 'completed';
    if (progress && progress > 0) return 'active';
    return 'pending';
}

function getFileProgressValue(filename: string): number {
    const progress = getFileProgress(filename);
    return progress === -1 ? 100 : progress;
}

function getFileProgressColor(filename: string): 'neutral' | 'info' | 'success' | 'error' {
    const status = getFileStatus(filename);
    if (status === 'failed') return 'error';
    if (status === 'completed') return 'success';
    if (status === 'active') return 'info';
    return 'neutral';
}

function getFileStatusIcon(filename: string): string {
    const status = getFileStatus(filename);
    if (status === 'failed') return 'i-mdi-alert-circle';
    if (status === 'completed') return 'i-mdi-check-circle';
    if (status === 'active') return 'i-mdi-download';
    return 'i-mdi-clock-outline';
}

function getFileStatusLabel(filename: string): string {
    const status = getFileStatus(filename);
    if (status === 'failed') return '失败';
    if (status === 'completed') return '已完成';
    if (status === 'active') return `${getFileProgress(filename)}%`;
    return '等待中';
}

function getFileDisplayName(file: DownloadMetaData): string {
    return file.name?.trim() || file.filename.split('/').at(-1) || '未命名文件';
}

function isAllDownloadsCompleted(): boolean {
    return allDownloadsCompleted.value && !downloadRunning.value;
}

async function save(): Promise<boolean> {
    if (!downloader.value || !isAllDownloadsCompleted()) {
        return false;
    }

    saving.value = true;
    try {
        const content = await downloader.value.save();
        if (!content) return false;
        const link = document.createElement('a');
        const objectUrl = URL.createObjectURL(content);
        link.href = objectUrl;
        link.download = `${new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, '')}.zip`;
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
        return true;
    } catch (error) {
        console.error('Failed to save download archive:', error);
        toast.add({
            title: '保存压缩包失败',
            description: getErrorMessage(error, '请稍后重试'),
            icon: 'i-mdi-alert-circle',
            color: 'error'
        });
        return false;
    } finally {
        saving.value = false;
    }
}

const LOTTIE_COMMENT = new Blob([
    '这是一个播放图标的 Lottie 文件，通常用于动态效果展示。请使用支持 Lottie 格式的工具或库来查看和使用此文件。'
], { type: 'text/plain' });

async function startDownload() {
    if (refreshingLinks.value || downloadRunning.value || saving.value) return;

    const runId = ++downloadRunId;
    if (props.refreshFileMetadatas) {
        refreshingLinks.value = true;
        try {
            const refreshedFiles = await props.refreshFileMetadatas();
            if (runId !== downloadRunId || !props.open) return;
            availableFiles.value = refreshedFiles;
        } catch (error) {
            if (runId !== downloadRunId) return;
            console.error('Failed to refresh download links:', error);
            toast.add({
                title: '刷新下载链接失败',
                description: getErrorMessage(error, '请稍后重试'),
                icon: 'i-mdi-link-variant-off',
                color: 'error'
            });
            return;
        } finally {
            if (runId === downloadRunId) {
                refreshingLinks.value = false;
            }
        }
    }

    if (runId !== downloadRunId) return;
    const files = [...fileList.value];
    if (files.length === 0) {
        toast.add({
            title: '没有符合当前格式设置的文件',
            description: '请至少选择一种可用的收藏集卡片格式',
            icon: 'i-mdi-alert-circle',
            color: 'warning'
        });
        return;
    }

    downloadProgress.value.clear();
    downloadErrors.value.clear();
    downloader.value?.cancelAllDownloads();
    const currentDownloader = new Downloader({
        maxConcurrentDownloads: store.maxParallelDownloads,
        taskOptions: {
            maxThreads: store.maxSingleDownloadThreads,
            chunkSize: 1024 * 1024,
        }
    });
    downloader.value = currentDownloader;
    step.value = 2;
    downloadRunning.value = true;
    files.forEach(file => downloadProgress.value.set(file.filename, 0));

    try {
        const lottieReadmeDirectories = new Set<string>();
        for (const file of files) {
            if (runId !== downloadRunId) return;

            if (file.type === ItemType.SVGA) {
                try {
                    const parser = new Parser();
                    downloadProgress.value.set(file.filename, 5);
                    const video = await parser.load(file.url);
                    if (runId !== downloadRunId) return;
                    downloadProgress.value.set(file.filename, 20);
                    const apng = await new SVGAConverter(video).convertToAPNG();
                    if (runId !== downloadRunId) return;
                    await currentDownloader.addRawData(file.filename, apng);
                    downloadProgress.value.set(file.filename, 100);
                } catch (error) {
                    if (runId !== downloadRunId) return;
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
                    if (runId !== downloadRunId) return;
                    downloadProgress.value.set(file.filename, Math.floor(loaded / total * 100));
                },
                OnFailed: (error: unknown) => {
                    if (runId !== downloadRunId) return;
                    console.error(`Download failed for ${file.filename}:`, error);
                    downloadProgress.value.set(file.filename, -1);
                    downloadErrors.value.set(file.filename, getErrorMessage(error, '下载失败'));
                },
                OnSuccess: () => {
                    if (runId !== downloadRunId) return;
                    downloadProgress.value.set(file.filename, 100);
                },
            });
        }

        await currentDownloader.startDownloads();
    } catch (error) {
        if (runId !== downloadRunId) return;
        console.error('Download process failed:', error);
        const message = getErrorMessage(error, '请重试下载');
        files.forEach((file) => {
            if (downloadProgress.value.get(file.filename) === 0) {
                downloadProgress.value.set(file.filename, -1);
                downloadErrors.value.set(file.filename, message);
            }
        });
        toast.add({
            title: '下载任务异常终止',
            description: message,
            icon: 'i-mdi-alert-circle',
            color: 'error'
        });
    } finally {
        if (runId === downloadRunId) {
            downloadRunning.value = false;
        }
    }
}

function closeModal(saved = false) {
    if (refreshingLinks.value || downloadRunning.value) {
        downloadRunId++;
        downloader.value?.cancelAllDownloads();
        refreshingLinks.value = false;
        downloadRunning.value = false;
    }
    emit('close', saved);
}

async function handlePrimaryAction() {
    if (step.value === 1) {
        await startDownload();
        return;
    }
    if (await save()) {
        closeModal(true);
    }
}

onBeforeUnmount(() => {
    downloadRunId++;
    downloader.value?.cancelAllDownloads();
});
</script>

<template>
  <div>
    <UModal
      :open="open"
      :dismissible="!isBusy"
      :close="!isBusy"
      :ui="{
        content: 'max-w-3xl',
        body: step === 1 ? '!p-0 overflow-y-auto' : '!p-0 !overflow-hidden min-h-0',
        footer: 'justify-between flex-wrap gap-3'
      }"
      @update:open="(value) => { if (!value) closeModal(false) }"
    >
      <template #header>
        <div class="flex w-full min-w-0 items-center gap-3 pr-8">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-md bg-elevated text-primary">
            <UIcon :name="refreshingLinks ? 'i-mdi-link-variant-plus' : (step === 1 ? 'i-mdi-tune-variant' : 'i-mdi-progress-download')" class="size-5" />
          </div>
          <div class="min-w-0 flex-1">
            <h2 class="truncate text-base font-semibold text-highlighted sm:text-lg">
              {{ refreshingLinks ? '正在刷新下载链接' : (step === 1 ? '下载设置' : '下载进度') }}
            </h2>
            <p class="truncate text-xs text-muted sm:text-sm">
              {{ refreshingLinks ? '正在获取所有已选来源的最新资源地址' : (step === 1 ? `${fileList.length} 个文件将加入下载` : `${settledCount} / ${fileList.length} 个文件已处理`) }}
            </p>
          </div>
          <UBadge color="neutral" variant="soft" size="md">
            {{ step }} / 2
          </UBadge>
        </div>
      </template>

      <template #body>
        <div v-if="step === 1" class="space-y-6 p-4 sm:p-6">
          <section>
            <div class="flex items-center gap-2">
              <UIcon name="i-mdi-speedometer" class="size-5 text-muted" />
              <h3 class="text-sm font-semibold text-highlighted">性能设置</h3>
            </div>

            <div class="mt-3 grid border-y border-default sm:grid-cols-2 sm:divide-x sm:divide-default">
              <div class="setting-row py-4 sm:pr-5">
                <div class="min-w-0">
                  <label for="download-parallel" class="block text-sm font-medium text-default">并行下载任务</label>
                  <p class="mt-0.5 text-xs text-muted">同时处理的文件数量</p>
                </div>
                <UInputNumber
                  id="download-parallel"
                  v-model="store.maxParallelDownloads"
                  data-tour="download-parallel"
                  class="w-28 shrink-0"
                  :min="1"
                  :max="8"
                  :step="1"
                />
              </div>
              <div class="setting-row border-t border-default py-4 sm:border-t-0 sm:pl-5">
                <div class="min-w-0">
                  <label for="download-threads" class="block text-sm font-medium text-default">单文件线程</label>
                  <p class="mt-0.5 text-xs text-muted">每个文件的分片并发数</p>
                </div>
                <UInputNumber
                  id="download-threads"
                  v-model="store.maxSingleDownloadThreads"
                  data-tour="download-threads"
                  class="w-28 shrink-0"
                  :min="1"
                  :max="4"
                  :step="1"
                />
              </div>
            </div>
          </section>

          <section>
            <div class="flex items-center gap-2">
              <UIcon name="i-mdi-file-multiple-outline" class="size-5 text-muted" />
              <h3 class="text-sm font-semibold text-highlighted">收藏集卡片格式</h3>
            </div>
            <UCheckboxGroup
              v-model="selectedDownloadTypes"
              data-tour="download-types"
              class="mt-3"
              :items="downloadTypeOptions"
              value-key="value"
              variant="card"
              color="secondary"
              indicator="end"
              :ui="{
                fieldset: '!grid grid-cols-1 gap-2 sm:grid-cols-2',
                item: 'min-w-0'
              }"
            >
              <template #label="{ item }">
                <span class="flex min-w-0 items-center gap-2">
                  <UIcon :name="getDownloadTypeIcon(item)" class="size-4 shrink-0 text-muted" />
                  <span class="truncate">{{ getDownloadTypeLabel(item) }}</span>
                </span>
              </template>
            </UCheckboxGroup>
          </section>

          <div class="flex items-center gap-3 border-y border-default bg-elevated/50 px-3 py-3">
            <UIcon name="i-mdi-archive-arrow-down-outline" class="size-5 shrink-0 text-primary" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-highlighted">压缩包内容</p>
              <p class="truncate text-xs text-muted">开始下载前刷新链接，完成后统一保存为 ZIP 文件</p>
            </div>
            <UBadge :color="fileList.length > 0 ? 'primary' : 'error'" variant="soft" size="md">
              {{ fileList.length }} 个文件
            </UBadge>
          </div>
        </div>

        <div v-else class="flex min-h-0 flex-col">
          <div class="shrink-0 space-y-4 p-4 sm:p-6">
            <div>
              <div class="mb-2 flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-highlighted">
                    {{ allDownloadsCompleted ? (failedCount > 0 ? '处理完成，部分文件失败' : '全部下载完成') : '正在处理下载队列' }}
                  </p>
                  <p class="text-xs text-muted">{{ settledCount }} / {{ fileList.length }} 个文件已处理</p>
                </div>
                <span class="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-highlighted">{{ overallProgress }}%</span>
              </div>
              <UProgress :model-value="overallProgress" :max="100" :color="overallProgressColor" size="md" />
            </div>

            <div class="grid grid-cols-4 divide-x divide-default border-y border-default py-3">
              <div class="status-counter">
                <span class="text-lg font-semibold tabular-nums text-highlighted">{{ pendingCount }}</span>
                <span class="text-xs text-muted">等待</span>
              </div>
              <div class="status-counter">
                <span class="text-lg font-semibold tabular-nums text-info">{{ activeCount }}</span>
                <span class="text-xs text-muted">进行</span>
              </div>
              <div class="status-counter">
                <span class="text-lg font-semibold tabular-nums text-success">{{ completedCount }}</span>
                <span class="text-xs text-muted">完成</span>
              </div>
              <div class="status-counter">
                <span class="text-lg font-semibold tabular-nums text-error">{{ failedCount }}</span>
                <span class="text-xs text-muted">失败</span>
              </div>
            </div>
          </div>

          <div class="download-file-list min-h-0 flex-1 divide-y divide-default overflow-y-auto border-t border-default">
            <div v-for="file in fileList" :key="file.filename" class="download-file-row px-4 py-3 sm:px-6">
              <div
                class="flex size-8 shrink-0 items-center justify-center rounded-md bg-elevated"
                :class="{
                  'text-dimmed': getFileStatus(file.filename) === 'pending',
                  'text-info': getFileStatus(file.filename) === 'active',
                  'text-success': getFileStatus(file.filename) === 'completed',
                  'text-error': getFileStatus(file.filename) === 'failed'
                }"
              >
                <UIcon :name="getFileStatusIcon(file.filename)" class="size-4" />
              </div>

              <div class="min-w-0">
                <div class="flex min-w-0 items-center gap-2">
                  <p class="truncate text-sm font-medium text-highlighted">{{ getFileDisplayName(file) }}</p>
                  <UBadge color="neutral" variant="outline" size="sm" class="max-w-40 shrink-0">
                    {{ ItemType.toString(file.type) }}
                  </UBadge>
                </div>
                <p class="mt-0.5 truncate text-xs text-muted" :title="file.filename">{{ file.filename }}</p>
                <UProgress
                  class="mt-2"
                  :model-value="getFileProgressValue(file.filename)"
                  :max="100"
                  :color="getFileProgressColor(file.filename)"
                  size="sm"
                />
                <p v-if="downloadErrors.get(file.filename)" class="mt-1 text-xs text-error break-words">
                  {{ downloadErrors.get(file.filename) }}
                </p>
              </div>

              <span
                class="w-14 shrink-0 text-right text-xs font-medium tabular-nums"
                :class="{
                  'text-muted': getFileStatus(file.filename) === 'pending',
                  'text-info': getFileStatus(file.filename) === 'active',
                  'text-success': getFileStatus(file.filename) === 'completed',
                  'text-error': getFileStatus(file.filename) === 'failed'
                }"
              >
                {{ getFileStatusLabel(file.filename) }}
              </span>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <p class="hidden text-xs text-muted sm:block">
          {{ step === 1 ? `将处理 ${fileList.length} 个文件` : `已完成 ${completedCount}，失败 ${failedCount}` }}
        </p>
        <div class="ml-auto flex w-full items-center justify-end gap-2 sm:w-auto">
          <UButton
            v-if="step === 2 && allDownloadsCompleted && failedCount > 0"
            icon="i-mdi-refresh"
            color="neutral"
            variant="outline"
            aria-label="重新下载"
            title="重新下载"
            :disabled="refreshingLinks || saving"
            @click="startDownload"
          />
          <UButton
            data-tour="download-cancel"
            icon="i-mdi-close"
            :label="refreshingLinks || saving ? '请稍候' : (isDownloading ? '停止并关闭' : (step === 2 ? '关闭' : '取消'))"
            color="neutral"
            variant="outline"
            :disabled="refreshingLinks || saving"
            @click="closeModal(false)"
          />
          <UButton
            data-tour="download-next"
            :icon="step === 1 ? 'i-mdi-download' : 'i-mdi-archive-arrow-down-outline'"
            :label="refreshingLinks ? '正在刷新链接' : (step === 1 ? '开始下载' : (isDownloading ? '正在下载' : '保存压缩包'))"
            color="primary"
            :loading="refreshingLinks || downloadRunning || saving"
            :disabled="refreshingLinks || (step === 1 && fileList.length === 0) || (step === 2 && !isAllDownloadsCompleted())"
            @click="handlePrimaryAction"
          />
        </div>
      </template>
    </UModal>
    <OnboardingTour v-if="open && step === 1" tour-id="download" :steps="onboardingSteps" />
  </div>
</template>

<style scoped>
.setting-row {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.status-counter {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.125rem;
}

.download-file-list {
  max-height: min(48dvh, 30rem);
  scrollbar-gutter: stable;
}

.download-file-row {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr) 3.5rem;
  align-items: start;
  gap: 0.75rem;
}

@media (max-width: 639px) {
  .download-file-list {
    max-height: 45dvh;
  }

  .download-file-row {
    gap: 0.625rem;
  }
}
</style>
