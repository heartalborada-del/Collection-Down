<script setup lang="ts">
import { ref } from 'vue';

const ParallelDownloads = ref(4);
const SingleDownloadThread = ref(4);

defineProps<{
    open: boolean;
}>();

const emit = defineEmits<{ close: [boolean] }>()

const step = ref(1);
</script>

<template>
    <UModal v-bind:open="open" :ui="{ footer: 'justify-end' }">
        <template #header>
            <div class="text-lg md:text-xl font-bold">下载选项</div>
        </template>

        <template #body>
            <template v-if="step === 1">
                <div class="mb-2">这里是下载选项</div>
                <USeparator size="md"></USeparator>
                <div class="grid grid-cols-2 gap-x-6 md:gap-y-0 gap-y-4 items-center mb-4 mt-2">
                    <div class="text-left pl-2 text-nowrap">最大并行下载任务数</div>
                    <UInputNumber v-model="ParallelDownloads" :min="1" :max="8" :step="1" />

                    <div class="text-left pl-2 text-nowrap">单任务下载线程数</div>
                    <UInputNumber v-model="SingleDownloadThread" :min="1" :max="6" :step="1" />
                </div>
            </template>
            <template v-else>
                //下载进度
            </template>
        </template>

        <template #footer>
            <UButton label="取消" color="neutral" variant="outline" @click="emit('close', false)" />
            <UButton :label="step === 1 ? '下一步' : '保存'" color="neutral" @click="emit('close', true)" />
        </template>
    </UModal>
</template>