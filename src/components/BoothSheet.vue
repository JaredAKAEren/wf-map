<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
  DrawerContent,
  DrawerDescription,
  DrawerHandle,
  DrawerRoot,
  DrawerTitle,
} from "reka-ui";
import { nextTick, ref, shallowRef, watch } from "vue";

import type { Booth } from "../data/exhibition";
import PhotoPanel from "./PhotoPanel.vue";
import AppIcon from "./ui/AppIcon.vue";

const props = defineProps<{ booth?: Booth; open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const displayed = shallowRef(props.booth);
const expanded = ref(false);
const gestureDragging = ref(false);
const gestureExpanded = ref(false);
const gestureY = ref(0);
const expandSwipeThreshold = 48;
const closeSwipeThreshold = 40;
const reverseCancelThreshold = 10;
const releaseVelocityThreshold = 0.3;
const minReleaseVelocityDuration = 16;
const maxReleaseVelocityAge = 80;
let pointerId: number | undefined;
let gestureStartY = 0;
let gestureCurrentY = 0;
let collapsedHeight = 0;
let expandedGrowth = 0;
let expandedDuringGesture = false;
let expansionPending = false;
let sheetElement: HTMLElement | undefined;
let dismissIntent = false;
let dismissCancelled = false;
let maxDownwardDistance = 0;
let lastDragSample: { time: number; y: number } | undefined;
let lastVelocityY = 0;

function handleOpenChange(open: boolean) {
  if (!open) {
    emit("close");
  }
}

function startExpandGesture(clientY: number, target: EventTarget | null) {
  sheetElement = (target as HTMLElement).closest<HTMLElement>(".booth-sheet") ?? undefined;
  if (!sheetElement) {
    return false;
  }

  gestureDragging.value = true;
  gestureStartY = clientY;
  gestureCurrentY = clientY;
  collapsedHeight = sheetElement.getBoundingClientRect().height;
  expandedGrowth = 0;
  expandedDuringGesture = false;
  expansionPending = false;
  dismissIntent = false;
  dismissCancelled = false;
  maxDownwardDistance = 0;
  lastDragSample = undefined;
  lastVelocityY = 0;

  return true;
}

async function expandDuringGesture() {
  if (expansionPending || expandedDuringGesture) {
    return;
  }

  expansionPending = true;
  gestureExpanded.value = true;
  expanded.value = true;
  await nextTick();
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
  if (!sheetElement) {
    expansionPending = false;
    return;
  }

  expandedGrowth = Math.max(0, sheetElement.getBoundingClientRect().height - collapsedHeight);
  expandedDuringGesture = true;
  expansionPending = false;
  updateExpandGesture(gestureCurrentY, performance.now());
}

function recordDragSample(clientY: number, time: number) {
  if (lastDragSample && time > lastDragSample.time) {
    const duration = Math.max(time - lastDragSample.time, minReleaseVelocityDuration);
    lastVelocityY = (clientY - lastDragSample.y) / duration;
  }
  lastDragSample = { time, y: clientY };
}

function updateExpandGesture(clientY: number, time: number) {
  gestureCurrentY = clientY;
  const downwardDistance = Math.max(0, clientY - gestureStartY);
  const upwardDistance = Math.max(0, gestureStartY - clientY);
  recordDragSample(clientY, time);
  if (!expandedDuringGesture) {
    if (!dismissIntent && downwardDistance > 0) {
      dismissIntent = true;
      maxDownwardDistance = downwardDistance;
    }
    if (dismissIntent) {
      maxDownwardDistance = Math.max(maxDownwardDistance, downwardDistance);
      if (
        !dismissCancelled &&
        maxDownwardDistance > closeSwipeThreshold / 2 &&
        maxDownwardDistance - downwardDistance > reverseCancelThreshold
      ) {
        dismissCancelled = true;
      }
      gestureY.value = downwardDistance || -Math.sqrt(upwardDistance);

      return;
    }

    gestureY.value = -Math.min(upwardDistance, expandSwipeThreshold);
    if (upwardDistance >= expandSwipeThreshold) {
      void expandDuringGesture();
    }

    return;
  }

  // 展开前后保持卡片顶部连续，新增内容先向下出现，再随继续上拉回到最终位置。
  gestureY.value = Math.max(0, expandedGrowth - upwardDistance);
}

function finishExpandGesture() {
  const velocityAge = lastDragSample ? performance.now() - lastDragSample.time : Infinity;
  const releaseVelocity = velocityAge <= maxReleaseVelocityAge ? lastVelocityY : 0;
  const downwardDistance = gestureCurrentY - gestureStartY;
  const shouldClose =
    !expandedDuringGesture &&
    !dismissCancelled &&
    (downwardDistance >= closeSwipeThreshold || releaseVelocity > releaseVelocityThreshold);
  gestureDragging.value = false;
  sheetElement = undefined;
  if (shouldClose) {
    emit("close");
  } else {
    gestureY.value = 0;
  }
}

function handlePointerDown(event: PointerEvent) {
  if (expanded.value || event.button !== 0) {
    return;
  }

  event.stopPropagation();
  if (!startExpandGesture(event.clientY, event.currentTarget)) {
    return;
  }

  pointerId = event.pointerId;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function handlePointerMove(event: PointerEvent) {
  if (event.pointerId !== pointerId) {
    return;
  }

  event.stopPropagation();
  updateExpandGesture(event.clientY, event.timeStamp);
}

function handlePointerEnd(event: PointerEvent) {
  if (event.pointerId !== pointerId) {
    return;
  }

  event.stopPropagation();
  finishExpandGesture();
  pointerId = undefined;
}

function handleTouchStart(event: TouchEvent) {
  if (pointerId !== undefined) {
    event.stopPropagation();
  }
}

watch(
  () => {
    return [props.booth, props.open] as const;
  },
  ([booth, open]) => {
    if (booth && open) {
      displayed.value = booth;
      expanded.value = false;
      gestureDragging.value = false;
      gestureExpanded.value = false;
      gestureY.value = 0;
      pointerId = undefined;
      sheetElement = undefined;
    }
  },
);

watch(expanded, (open) => {
  if (!open) {
    gestureExpanded.value = false;
  }
});
</script>

<template>
  <div>
    <DrawerRoot :open="open" :modal="false" @update:open="handleOpenChange">
      <DrawerContent
        class="booth-sheet ui-surface"
        :class="{
          'is-gesture-dragging': gestureDragging,
          'is-gesture-expanded': gestureExpanded,
        }"
        :style="`--sheet-gesture-y: ${gestureY}px`"
        aria-label="展位详情"
        :aria-labelledby="undefined"
        :inert="!open"
        @interact-outside.prevent
      >
        <template v-if="displayed">
          <div
            class="sheet-drag-region"
            @pointerdown="handlePointerDown"
            @pointermove="handlePointerMove"
            @pointerup="handlePointerEnd"
            @pointercancel="handlePointerEnd"
            @touchstart="handleTouchStart"
          >
            <DrawerHandle class="sheet-handle"><span /></DrawerHandle>
            <div class="sheet-heading">
              <DrawerTitle class="sheet-code">{{ displayed.code }}</DrawerTitle>
              <span>{{ displayed.hall }}馆</span>
            </div>
          </div>
          <DrawerDescription class="booth-names" @pointerdown.stop @touchstart.stop>
            {{ displayed.names.join(" / ") || "名称待补充 · 可按编号定位" }}
          </DrawerDescription>
          <CollapsibleRoot v-model:open="expanded" :unmount-on-hide="false">
            <CollapsibleTrigger class="details-link ui-text-button">
              {{ expanded ? "收起贴图" : "展开贴图" }}
              <AppIcon name="chevron" />
            </CollapsibleTrigger>
            <CollapsibleContent
              class="photo-reveal"
              :inert="!expanded"
              @pointerdown.stop
              @touchstart.stop
            >
              <PhotoPanel
                :key="displayed.id"
                :booth="displayed"
                :active="open"
                :expanded="expanded"
                insert-position="end"
              />
            </CollapsibleContent>
          </CollapsibleRoot>
        </template>
      </DrawerContent>
    </DrawerRoot>
  </div>
</template>

<style scoped>
.booth-sheet {
  padding: 0 16px 12px;
  max-height: 65dvh;
  overflow-y: auto;
  transform: translateY(calc(var(--drawer-swipe-movement-y, 0px) + var(--sheet-gesture-y, 0px)));
  transition: transform var(--duration-normal);
}

.booth-sheet[data-swiping],
.booth-sheet.is-gesture-dragging {
  transition-duration: 0ms;
}

.booth-sheet[data-state="open"] {
  animation: sheet-in var(--duration-normal);
}

.booth-sheet[data-state="closed"] {
  animation: sheet-out var(--duration-fast);
}

@keyframes sheet-in {
  from {
    opacity: 0;
    translate: 0 24px;
  }
}

@keyframes sheet-out {
  to {
    opacity: 0;
    translate: 0 calc(100% + 24px);
  }
}

.sheet-drag-region {
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.sheet-drag-region:active,
.booth-sheet[data-swiping] .sheet-drag-region {
  cursor: grabbing;
}

.sheet-handle {
  display: grid;
  place-items: center;
  height: 28px;
}

.sheet-handle span {
  width: 32px;
  height: 4px;
  background: var(--color-handle);
  border-radius: var(--radius-pill);
}

.sheet-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
}

.sheet-code {
  font-size: 28px;
}

.sheet-heading span {
  color: var(--color-muted);
  font-size: 12px;
}

.booth-names {
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.6;
  word-break: break-all;
}

.details-link {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 44px;
}

.details-link svg {
  width: 16px;
  height: 16px;
  transition: rotate var(--duration-normal);
}

.details-link[data-state="open"] svg {
  rotate: 180deg;
}

.photo-reveal {
  overflow: hidden;
}

.photo-reveal[data-state="open"] {
  animation: reveal var(--duration-normal) ease-out;
}

.photo-reveal[data-state="closed"] {
  animation: conceal var(--duration-normal) ease-out;
}

.booth-sheet.is-gesture-dragging .photo-reveal,
.booth-sheet.is-gesture-expanded .photo-reveal {
  animation: none;
}

@keyframes reveal {
  from {
    height: 0;
    opacity: 0;
  }

  to {
    height: var(--reka-collapsible-content-height);
    opacity: 1;
  }
}

@keyframes conceal {
  from {
    height: var(--reka-collapsible-content-height);
    opacity: 1;
  }

  to {
    height: 0;
    opacity: 0;
  }
}
</style>
