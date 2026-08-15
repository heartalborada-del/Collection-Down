<script setup lang="ts">
export type OnboardingStep = {
  title: string
  description: string
  icon: string
  target?: string
}

const props = defineProps<{
  tourId: string
  steps: OnboardingStep[]
}>()
const emit = defineEmits<{
  stepChange: [index: number]
  openChange: [open: boolean]
}>()

const { requestedTour, activeTour } = useOnboardingTour()
const open = ref(false)
const currentIndex = ref(0)
const panel = ref<HTMLElement | null>(null)
const targetRect = ref<DOMRect | null>(null)

const currentStep = computed(() => props.steps[currentIndex.value])
const storageKey = computed(() => `collection-down:onboarding:${props.tourId}:v2`)

const highlightStyle = computed(() => {
  const rect = targetRect.value
  if (!rect) return undefined
  return {
    top: `${rect.top - 6}px`,
    left: `${rect.left - 6}px`,
    width: `${rect.width + 12}px`,
    height: `${rect.height + 12}px`,
  }
})

const panelStyle = computed(() => {
  const rect = targetRect.value
  if (!rect || !import.meta.client) return undefined

  const width = Math.min(300, window.innerWidth - 24)
  const left = Math.min(
    Math.max(12, rect.left + rect.width / 2 - width / 2),
    window.innerWidth - width - 12,
  )
  const placeBelow = window.innerHeight - rect.bottom >= 290
  return {
    top: placeBelow ? `${rect.bottom + 14}px` : `${Math.max(12, rect.top - 274)}px`,
    left: `${left}px`,
    width: `${width}px`,
  }
})

function findVisibleTarget(selector?: string): HTMLElement | null {
  if (!selector) return null
  return [...document.querySelectorAll<HTMLElement>(selector)]
    .find(element => element.getClientRects().length > 0) ?? null
}

async function updateTarget() {
  await nextTick()
  const target = findVisibleTarget(currentStep.value?.target)
  if (!target) {
    targetRect.value = null
    panel.value?.focus()
    return
  }

  target.scrollIntoView({ block: 'center', behavior: 'smooth' })
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      targetRect.value = target.getBoundingClientRect()
      panel.value?.focus()
    })
  })
}

async function startTour() {
  if (props.steps.length === 0) return

  activeTour.value = props.tourId
  currentIndex.value = 0
  open.value = true
  emit('openChange', true)
  emit('stepChange', currentIndex.value)
  await nextTick()
  await updateTarget()
}

function closeTour(completed: boolean) {
  if (completed) localStorage.setItem(storageKey.value, 'completed')
  open.value = false
  targetRect.value = null
  if (activeTour.value === props.tourId) activeTour.value = null
  emit('openChange', false)
}

async function previousStep() {
  if (currentIndex.value === 0) return
  currentIndex.value--
  emit('stepChange', currentIndex.value)
  await nextTick()
  await updateTarget()
}

async function nextStep() {
  if (currentIndex.value >= props.steps.length - 1) {
    closeTour(true)
    return
  }
  currentIndex.value++
  emit('stepChange', currentIndex.value)
  await nextTick()
  await updateTarget()
}

function refreshTarget() {
  const target = findVisibleTarget(currentStep.value?.target)
  targetRect.value = target?.getBoundingClientRect() ?? null
}

watch(requestedTour, async (tourId) => {
  if (tourId !== props.tourId) return
  requestedTour.value = null
  await startTour()
})

watch(activeTour, (tourId) => {
  if (!open.value || tourId === props.tourId) return
  closeTour(false)
})

onMounted(() => {
  window.addEventListener('resize', refreshTarget, { passive: true })
  window.addEventListener('scroll', refreshTarget, { passive: true, capture: true })
  if (localStorage.getItem(storageKey.value) !== 'completed') void startTour()
})

onUnmounted(() => {
  if (open.value) closeTour(false)
  window.removeEventListener('resize', refreshTarget)
  window.removeEventListener('scroll', refreshTarget, { capture: true })
})
</script>

<template>
  <Teleport to="body">
    <Transition name="onboarding-fade">
      <div v-if="open && currentStep" class="onboarding-layer">
        <div v-if="!targetRect" class="onboarding-backdrop" />
        <div v-else class="onboarding-highlight" :style="highlightStyle" />

        <div
          ref="panel"
          class="onboarding-panel"
          :class="{ 'onboarding-panel-centered': !targetRect }"
          :style="panelStyle"
          role="dialog"
          aria-modal="true"
          :aria-label="currentStep.title"
          tabindex="-1"
        >
          <UCard>
            <div class="flex items-start gap-3">
              <div class="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <UIcon :name="currentStep.icon" class="size-5" />
              </div>
              <div class="min-w-0 grow">
                <div class="mb-1 flex items-center justify-between gap-3">
                  <h2 class="text-base font-semibold">{{ currentStep.title }}</h2>
                  <span class="text-xs text-muted">{{ currentIndex + 1 }} / {{ steps.length }}</span>
                </div>
                <p class="text-sm leading-6 text-muted">{{ currentStep.description }}</p>
              </div>
            </div>

            <UProgress class="mt-4" :model-value="currentIndex + 1" :max="steps.length" size="xs" />

            <div class="mt-4 flex items-center justify-between gap-2">
              <UButton color="neutral" variant="ghost" size="sm" @click="closeTour(true)">跳过</UButton>
              <div class="flex gap-2">
                <UButton
                  v-if="currentIndex > 0"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  icon="i-mdi-chevron-left"
                  @click="previousStep"
                >
                  上一步
                </UButton>
                <UButton
                  size="sm"
                  :icon="currentIndex === steps.length - 1 ? 'i-mdi-check' : undefined"
                  :trailing-icon="currentIndex < steps.length - 1 ? 'i-mdi-chevron-right' : undefined"
                  @click="nextStep"
                >
                  {{ currentIndex === steps.length - 1 ? '完成' : '下一步' }}
                </UButton>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.onboarding-layer {
  position: fixed;
  inset: 0;
  z-index: 100;
  pointer-events: auto;
}

.onboarding-backdrop {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 58%);
}

.onboarding-highlight {
  position: fixed;
  border: 2px solid var(--ui-primary);
  border-radius: 6px;
  box-shadow: 0 0 0 9999px rgb(0 0 0 / 58%);
  pointer-events: none;
  transition: inset 180ms ease, width 180ms ease, height 180ms ease;
}

.onboarding-panel {
  position: fixed;
  z-index: 101;
  max-width: calc(100vw - 24px);
  outline: none;
}

.onboarding-panel-centered {
  top: 50%;
  left: 50%;
  width: min(300px, calc(100vw - 24px));
  transform: translate(-50%, -50%);
}

.onboarding-fade-enter-active,
.onboarding-fade-leave-active {
  transition: opacity 160ms ease;
}

.onboarding-fade-enter-from,
.onboarding-fade-leave-to {
  opacity: 0;
}

@media (max-width: 639px) {
  .onboarding-panel:not(.onboarding-panel-centered) {
    top: auto !important;
    right: auto;
    bottom: 12px;
    left: 50% !important;
    width: min(300px, calc(100vw - 24px)) !important;
    transform: translateX(-50%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .onboarding-highlight,
  .onboarding-fade-enter-active,
  .onboarding-fade-leave-active {
    transition: none;
  }
}
</style>
