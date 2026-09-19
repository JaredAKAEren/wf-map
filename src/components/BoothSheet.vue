<script setup lang="ts">
import { ref, watch } from "vue";

import type { Booth } from "../data/exhibition";
import PhotoPanel from "./PhotoPanel.vue";

const props = defineProps<{ booth: Booth }>();
const emit = defineEmits<{ close: [] }>();

const expanded = ref(false);
const dragY = ref(0);
const dragging = ref(false);
let pointerId: number | undefined;
let startY = 0;
let moved = false;

function startDrag(event: PointerEvent) {
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  if (pointerId !== undefined) {
    return;
  }

  pointerId = event.pointerId;
  startY = event.clientY;
  moved = false;
  dragging.value = true;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function moveDrag(event: PointerEvent) {
  if (pointerId !== event.pointerId) {
    return;
  }

  const distance = event.clientY - startY;
  if (Math.abs(distance) > 6) {
    moved = true;
  }
  dragY.value = Math.max(0, distance);
}

function finishDrag(event: PointerEvent) {
  if (pointerId !== event.pointerId) {
    return;
  }

  pointerId = undefined;
  dragging.value = false;

  if (dragY.value >= 64) {
    emit("close");
  } else {
    dragY.value = 0;
  }
}

function cancelDrag(event: PointerEvent) {
  if (pointerId !== event.pointerId) {
    return;
  }

  pointerId = undefined;
  dragging.value = false;
  dragY.value = 0;
  moved = true;
}

function toggle(event: MouseEvent) {
  if (event.detail === 0 || !moved) {
    expanded.value = !expanded.value;
  }
}

watch(
  () => {
    return props.booth.id;
  },
  () => {
    expanded.value = false;
  },
);
</script>

<template>
  <aside
    class="booth-sheet ui-surface"
    :class="{ expanded, dragging }"
    :style="{ '--sheet-offset': `${dragY}px` }"
    aria-label="展位详情"
    @keydown.esc="emit('close')"
  >
    <button
      class="sheet-toggle"
      :aria-expanded="expanded"
      aria-label="展开或收起展位详情，下滑关闭"
      @pointerdown="startDrag"
      @pointermove="moveDrag"
      @pointerup="finishDrag"
      @pointercancel="cancelDrag"
      @lostpointercapture="cancelDrag"
      @click="toggle"
    >
      <span />
    </button>
    <div class="sheet-heading">
      <div>
        <p class="eyebrow">{{ booth.hall }} 馆 · 展位</p>
        <h2>{{ booth.code }}</h2>
      </div>
    </div>
    <p class="booth-names">{{ booth.names.join(" / ") || "名称待补充 · 可按编号定位" }}</p>
    <button class="details-link text-button" @click="expanded = !expanded">
      {{ expanded ? "收起详情 ↓" : "展位照片与详情 ↑" }}
    </button>
    <div class="photo-reveal" :class="{ expanded }" :inert="!expanded">
      <div><PhotoPanel :booth="booth" /></div>
    </div>
  </aside>
</template>

<style scoped>
.booth-sheet {
  padding: 0 16px 12px;
  max-height: 65dvh;
  overflow-y: auto;
  transform: translateY(var(--sheet-offset, 0));
  transition:
    transform var(--duration-normal),
    opacity var(--duration-normal);
}

.booth-sheet.dragging {
  transition: none;
}

.booth-sheet.sheet-enter-from {
  opacity: 0;
  transform: translateY(24px);
}

.booth-sheet.sheet-leave-to {
  opacity: 0;
  transform: translateY(calc(100% + 24px));
}

.booth-sheet.sheet-leave-active {
  transition-duration: var(--duration-fast);
}

.sheet-toggle {
  display: block;
  width: 100%;
  height: 28px;
  touch-action: none;
  user-select: none;
  background: transparent;
}

.sheet-toggle span {
  display: block;
  width: 32px;
  height: 4px;
  margin: auto;
  background: var(--color-handle);
  border-radius: var(--radius-pill);
}

.sheet-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.sheet-heading h2 {
  font-size: 28px;
}

.booth-names {
  margin: 4px 0 12px;
  font-size: 13px;
  line-height: 1.6;
}

.details-link {
  display: block;
  margin: 4px auto 0;
  min-height: 36px;
}

.photo-reveal {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows var(--duration-normal),
    opacity var(--duration-normal);
}

.photo-reveal.expanded {
  grid-template-rows: 1fr;
  opacity: 1;
}

.photo-reveal > div {
  overflow: hidden;
}
</style>
