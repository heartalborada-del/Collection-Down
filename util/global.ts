import type {Step} from "vue3-tour";

const APIPrefix = '/bili/ts/';
const tourSteps = new Map<string, Step[]>([
    ['metadata', [
        {
            target: '[data-v-step="download"]',
            content: '下载按钮, 你可以在选择要下载的文件后点击该按钮进行下载'
        },
        {
            target: '[data-v-step="setting"]',
            content: '设置按钮, 设置部分全局属性'
        },
        {
            target: '[data-v-step="URL"]',
            content: '链接输入框, 输入完后会自动解析'
        },
        {
            target: '[data-v-step="startTour"]',
            content: '引导按钮, 点击可再次查看引导教程'
        }
    ]]
]);
export {APIPrefix, tourSteps}