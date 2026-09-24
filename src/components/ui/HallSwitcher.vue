<script setup lang="ts">
import { ToggleGroupItem, ToggleGroupRoot } from "reka-ui";
import { onUnmounted, ref, watch } from "vue";

import type { Hall } from "../../data/exhibition";

const props = defineProps<{ modelValue: Hall; halls: readonly Hall[] }>();
const emit = defineEmits<{
  select: [hall: Hall];
  "scrub-start": [];
  "scrub-move": [steps: number];
  "scrub-end": [steps: number];
  "scrub-cancel": [];
}>();

const held = ref(false);
const dragging = ref(false);
const previewHall = ref<Hall>();
const holdDuration = 300;
const moveThreshold = 8;
let pointerId: number | undefined;
let startX = 0;
let startY = 0;
let originIndex = 0;
let currentSteps = 0;
let movedBeforeHold = false;
let suppressClick = false;
let holdTimer: ReturnType<typeof setTimeout> | undefined;

function clearHoldTimer() {
  clearTimeout(holdTimer);
  holdTimer = undefined;
}

function resetGesture() {
  clearHoldTimer();
  pointerId = undefined;
  held.value = false;
  dragging.value = false;
  movedBeforeHold = false;
}

function stepWidth(target: EventTarget | null) {
  const root = (target as HTMLElement).closest<HTMLElement>(".hall-switcher");
  const buttons = root?.querySelectorAll<HTMLElement>("button");
  if (!buttons || buttons.length < 2) {
    return 1;
  }

  const first = buttons[0]!.getBoundingClientRect();
  const second = buttons[1]!.getBoundingClientRect();

  return second.left + second.width / 2 - first.left - first.width / 2;
}

function handlePointerDown(event: PointerEvent, name: Hall) {
  if (pointerId !== undefined) {
    return;
  }

  suppressClick = false;
  if (name !== props.modelValue || (event.pointerType === "mouse" && event.button !== 0)) {
    return;
  }

  resetGesture();
  pointerId = event.pointerId;
  startX = event.clientX;
  startY = event.clientY;
  originIndex = props.halls.indexOf(name);
  currentSteps = 0;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  holdTimer = setTimeout(() => {
    if (pointerId === event.pointerId && !movedBeforeHold) {
      held.value = true;
    }
  }, holdDuration);
}

function handlePointerMove(event: PointerEvent) {
  if (event.pointerId !== pointerId) {
    return;
  }

  const dx = event.clientX - startX;
  const dy = event.clientY - startY;

  if (!held.value) {
    if (Math.hypot(dx, dy) > moveThreshold) {
      movedBeforeHold = true;
      suppressClick = true;
      clearHoldTimer();
    }

    return;
  }

  if (!dragging.value) {
    if (Math.abs(dy) > moveThreshold && Math.abs(dy) > Math.abs(dx)) {
      suppressClick = true;
      resetGesture();
      return;
    }
    if (Math.abs(dx) < moveThreshold) {
      return;
    }

    dragging.value = true;
    emit("scrub-start");
  }

  currentSteps = Math.max(
    -originIndex,
    Math.min(props.halls.length - 1 - originIndex, dx / stepWidth(event.currentTarget)),
  );
  previewHall.value = props.halls[Math.round(originIndex + currentSteps)];
  emit("scrub-move", currentSteps);
}

function handlePointerUp(event: PointerEvent) {
  if (event.pointerId !== pointerId) {
    return;
  }

  const wasHeld = held.value;
  const wasDragging = dragging.value;
  const steps = currentSteps;
  suppressClick = wasHeld || movedBeforeHold;

  resetGesture();

  if (wasDragging) {
    emit("scrub-end", steps);
  } else {
    previewHall.value = undefined;
  }

  setTimeout(() => {
    suppressClick = false;
  }, 0);
}

function handlePointerCancel(event: PointerEvent) {
  if (event.pointerId !== pointerId) {
    return;
  }

  const wasDragging = dragging.value;
  suppressClick = true;

  resetGesture();
  previewHall.value = undefined;

  if (wasDragging) {
    emit("scrub-cancel");
  }

  setTimeout(() => {
    suppressClick = false;
  }, 0);
}

function handleClick(event: MouseEvent, name: Hall) {
  if ((suppressClick || held.value) && event.detail !== 0) {
    event.preventDefault();
    event.stopPropagation();
    suppressClick = false;
    return;
  }

  emit("select", name);
}

watch(
  () => {
    return props.modelValue;
  },
  () => {
    if (!dragging.value) {
      previewHall.value = undefined;
    }
  },
);

onUnmounted(() => {
  clearHoldTimer();
});
</script>

<template>
  <ToggleGroupRoot
    class="hall-switcher ui-surface"
    type="single"
    :model-value="previewHall ?? modelValue"
    aria-label="展馆选择"
    @contextmenu.prevent
  >
    <ToggleGroupItem
      v-for="name in halls"
      :key="name"
      :value="name"
      :class="{ 'is-held': held && name === (previewHall ?? modelValue) }"
      @pointerdown="handlePointerDown($event, name)"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerCancel"
      @lostpointercapture="handlePointerCancel"
      @click="handleClick($event, name)"
      >{{ name }}</ToggleGroupItem
    >
  </ToggleGroupRoot>
</template>

<style scoped>
.hall-switcher {
  --active-x: 0;
  --held-scale: 1;

  position: relative;
  display: flex;
  padding: 5px;
  gap: 2px;
  border-radius: var(--radius-pill);
}

.hall-switcher:has(> button.is-held) {
  --held-scale: 1.13;
}

.hall-switcher:has(> button:nth-of-type(2)[data-state="on"]) {
  --active-x: calc(100% + 2px);
}

.hall-switcher:has(> button:nth-of-type(3)[data-state="on"]) {
  --active-x: calc(200% + 4px);
}

.hall-switcher:has(> button:nth-of-type(4)[data-state="on"]) {
  --active-x: calc(300% + 6px);
}

.hall-switcher:has(> button:nth-of-type(5)[data-state="on"]) {
  --active-x: calc(400% + 8px);
}

.hall-switcher::before {
  position: absolute;
  top: 5px;
  bottom: 5px;
  left: 5px;
  width: calc((100% - 18px) / 5);
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  box-shadow: none;
  content: "";
  pointer-events: none;
  translate: var(--active-x) 0;
  scale: var(--held-scale);
  transition:
    translate var(--duration-normal) ease-out,
    scale var(--duration-fast),
    box-shadow var(--duration-fast);
}

.hall-switcher:has(> button.is-held)::before {
  box-shadow: var(--shadow-floating);
}

.hall-switcher button {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 42px;
  border-radius: var(--radius-pill);
  background: transparent;
  font-weight: 650;
  font-size: 13px;
  transition:
    transform var(--duration-fast),
    color var(--duration-normal);
  user-select: none;
}

.hall-switcher button[data-state="on"] {
  color: var(--color-on-primary);
  touch-action: none;
}

.hall-switcher button.is-held {
  transform: scale(1.13);
}
</style>
