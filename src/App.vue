<script setup lang="ts">
import { Preferences } from "@capacitor/preferences";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

import BoothSheet from "./components/BoothSheet.vue";
import MapSearch from "./components/MapSearch.vue";
import AppIcon from "./components/ui/AppIcon.vue";
import HallSwitcher from "./components/ui/HallSwitcher.vue";
import { useMapViewport } from "./composables/useMapViewport";
import { booths, halls, isHall, type Booth, type Hall } from "./data/exhibition";
import type { Point, View } from "./domain/viewport";

type HallScrub = {
  originHall: Hall;
  originalView: View;
  originalSelection: string;
  startedAt: number;
  steps: number;
  frame: number;
};

const map = ref<SVGSVGElement>();
const search = ref<InstanceType<typeof MapSearch>>();
const selectedId = ref("");
const hall = ref<Hall>("W5");
const notice = ref("");
const searchOpen = ref(false);
const ready = ref(false);
const pageHeight = ref("100dvh");
let selectionVersion = 0;
let hallScrub: HallScrub | undefined;
const selected = computed(() => {
  return booths.find((booth) => {
    return booth.id === selectedId.value;
  });
});

const offset = (name: Hall) => {
  return halls.indexOf(name) * 860;
};

function boothAt(point: Point) {
  return booths.find((entry) => {
    return (
      point.x >= offset(entry.hall) + entry.x &&
      point.x <= offset(entry.hall) + entry.x + entry.width &&
      point.y >= entry.y &&
      point.y <= entry.y + entry.height
    );
  });
}

function selectAt(point: Point) {
  const booth = boothAt(point);

  void search.value?.close(false);
  selectedId.value = booth?.id ?? "";
  notice.value = "";
  selectionVersion++;

  if (booth) {
    hall.value = booth.hall;
    void revealBooth(booth, { ...view.value }, selectionVersion);
  }
}

const { view, viewBox, moveTo, setView, zoom, down, move, up, cancel, wheel } = useMapViewport(
  map,
  {
    onSelect: selectAt,
  },
);

function hallView(name: Hall): View {
  return { x: offset(name) + 50, y: 160, width: 700, height: 1260 };
}

function focusHall(name: Hall) {
  if (hallScrub) {
    cancelAnimationFrame(hallScrub.frame);
    hallScrub = undefined;
  }

  selectionVersion++;
  hall.value = name;
  selectedId.value = "";
  moveTo(hallView(name));
}

function boothView(booth: Booth): View {
  return {
    x: offset(booth.hall) + booth.x + booth.width / 2 - 210,
    y: booth.y + booth.height / 2 - 260,
    width: 420,
    height: 520,
  };
}

async function revealBooth(booth: Booth, base: View, version: number) {
  await nextTick();
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
  if (version !== selectionVersion || selectedId.value !== booth.id || searchOpen.value) {
    return;
  }

  const mapRect = map.value?.getBoundingClientRect();
  const sheetRect = document.querySelector<HTMLElement>(".sheet-position")?.getBoundingClientRect();

  if (!mapRect || !sheetRect) {
    moveTo(base);
    return;
  }

  const scale = Math.min(mapRect.width / base.width, mapRect.height / base.height);
  const boothBottom =
    mapRect.top +
    (mapRect.height - base.height * scale) / 2 +
    (booth.y + booth.height - base.y) * scale;
  const overlap = boothBottom - sheetRect.top;
  const target = overlap > 0 ? { ...base, y: base.y + (overlap + 12) / scale } : base;

  if (
    target.x !== view.value.x ||
    target.y !== view.value.y ||
    target.width !== view.value.width ||
    target.height !== view.value.height
  ) {
    moveTo(target);
  }
}

function choose(booth: Booth) {
  selectedId.value = booth.id;
  hall.value = booth.hall;
  notice.value = "";
  selectionVersion++;

  void revealBooth(booth, boothView(booth), selectionVersion);
}

function renderHallScrub(now: number) {
  const state = hallScrub;
  if (!state) {
    return;
  }

  const base = hallView(state.originHall);
  const progress = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 1
    : Math.min(1, (now - state.startedAt) / 140);
  const eased = 1 - (1 - progress) ** 3;

  setView({
    x: state.originalView.x + (base.x - state.originalView.x + state.steps * 860) * eased,
    y: state.originalView.y + (base.y - state.originalView.y) * eased,
    width: state.originalView.width + (base.width - state.originalView.width) * eased,
    height: state.originalView.height + (base.height - state.originalView.height) * eased,
  });

  if (progress < 1) {
    state.frame = requestAnimationFrame(renderHallScrub);
  } else {
    state.frame = 0;
  }
}

function startHallScrub() {
  selectionVersion++;
  const originalView = { ...view.value };

  setView(originalView);
  hallScrub = {
    originHall: hall.value,
    originalView,
    originalSelection: selectedId.value,
    startedAt: performance.now(),
    steps: 0,
    frame: requestAnimationFrame(renderHallScrub),
  };

  selectedId.value = "";
}

function moveHallScrub(steps: number) {
  if (!hallScrub) {
    return;
  }

  hallScrub.steps = steps;
  if (!hallScrub.frame) {
    const base = hallView(hallScrub.originHall);

    setView({ ...base, x: base.x + steps * 860 });
  }
}

function endHallScrub(steps: number) {
  if (!hallScrub) {
    return;
  }

  const originIndex = halls.indexOf(hallScrub.originHall);
  const target = halls[Math.round(originIndex + steps)]!;

  cancelAnimationFrame(hallScrub.frame);
  hallScrub = undefined;
  hall.value = target;
  moveTo(hallView(target));
}

function cancelHallScrub() {
  if (!hallScrub) {
    return;
  }

  const state = hallScrub;

  cancelAnimationFrame(state.frame);
  hallScrub = undefined;
  hall.value = state.originHall;
  selectedId.value = state.originalSelection;
  moveTo(state.originalView);
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let saving = Promise.resolve();
let visualViewport: VisualViewport | null = null;

function syncPageHeight() {
  pageHeight.value = `${visualViewport?.height ?? window.innerHeight}px`;
}

function persist() {
  if (!ready.value) {
    return;
  }
  const value = JSON.stringify({
    view: view.value,
    selectedId: selectedId.value,
    hall: hall.value,
  });
  saving = saving
    .then(() => {
      return Preferences.set({ key: "wf-map/session-v1", value });
    })
    .catch(() => {
      notice.value = "状态保存失败，重新打开后可能无法恢复当前视图。";
    });
}
watch(
  [view, selectedId, hall],
  () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 150);
  },
  { deep: true },
);

function leaving() {
  if (document.visibilityState === "hidden") {
    persist();
  }
}

const validId = (value: unknown) => {
  return typeof value === "string" &&
    booths.some((booth) => {
      return booth.id === value;
    })
    ? value
    : "";
};
onMounted(async () => {
  visualViewport = window.visualViewport;
  window.addEventListener("resize", syncPageHeight);
  visualViewport?.addEventListener("resize", syncPageHeight);
  syncPageHeight();
  document.addEventListener("visibilitychange", leaving);
  try {
    const saved = await Preferences.get({ key: "wf-map/session-v1" });
    if (saved.value) {
      const state = JSON.parse(saved.value) as Record<string, unknown>;
      selectedId.value = validId(state.selectedId);
      const savedHall = isHall(state.hall) ? state.hall : undefined;
      if (savedHall) {
        hall.value = savedHall;
      }
      const candidate = state.view as View | undefined;
      if (
        savedHall &&
        candidate &&
        [candidate.x, candidate.y, candidate.width, candidate.height].every(Number.isFinite) &&
        candidate.width >= 160 &&
        candidate.width <= 6000 &&
        candidate.height > 0 &&
        candidate.height < 20000
      ) {
        view.value = candidate;
      }
    }
  } catch {
    notice.value = "上次视图无法恢复，已打开 W5 地图。";
  }
  ready.value = true;
  persist();
});
onUnmounted(() => {
  selectionVersion++;
  if (hallScrub) {
    cancelAnimationFrame(hallScrub.frame);
  }

  persist();
  clearTimeout(saveTimer);
  window.removeEventListener("resize", syncPageHeight);
  visualViewport?.removeEventListener("resize", syncPageHeight);
  document.removeEventListener("visibilitychange", leaving);
});
</script>

<template>
  <main
    class="map-page"
    :class="{ 'has-selection': selected, 'search-open': searchOpen }"
    :style="{ height: pageHeight }"
  >
    <div class="map-area">
      <svg
        ref="map"
        class="map"
        :viewBox="viewBox"
        role="img"
        aria-label="五馆展位地图，可拖动和缩放"
        @pointerdown="down"
        @pointermove="move"
        @pointerup="up"
        @pointercancel="cancel"
        @lostpointercapture="cancel"
        @contextmenu.prevent
        @wheel.prevent="wheel"
      >
        <g v-for="name in halls" :key="name" :transform="`translate(${offset(name)},0)`">
          <image :href="`/maps/${name}.png`" width="800" :height="name === 'W1' ? 1500 : 1480" />
          <rect
            v-if="selected?.hall === name"
            :x="selected.x - 1"
            :y="selected.y - 1"
            :width="selected.width + 2"
            :height="selected.height + 2"
            rx="10"
            class="selected-booth"
          />
        </g>
      </svg>
    </div>
    <header class="map-header">
      <MapSearch
        ref="search"
        :preferred-hall="hall || undefined"
        @select="choose"
        @open="searchOpen = $event"
      />
    </header>
    <div class="map-controls ui-surface">
      <button class="ui-icon-button" aria-label="放大地图" @click="zoom(0.75)">
        <AppIcon class="control-icon" name="plus" />
      </button>
      <button class="ui-icon-button" aria-label="缩小地图" @click="zoom(1.33)">
        <AppIcon class="control-icon" name="minus" />
      </button>
    </div>
    <Transition name="float">
      <p v-if="notice" class="toast ui-surface" role="status">
        {{ notice
        }}<button class="ui-icon-button" aria-label="关闭提示" @click="notice = ''">
          <AppIcon name="close" />
        </button>
      </p>
    </Transition>
    <HallSwitcher
      class="hall-position"
      :model-value="hall"
      :halls="halls"
      @select="focusHall"
      @scrub-start="startHallScrub"
      @scrub-move="moveHallScrub"
      @scrub-end="endHallScrub"
      @scrub-cancel="cancelHallScrub"
    />
    <BoothSheet
      class="sheet-position"
      :booth="selected"
      :open="Boolean(selected) && !searchOpen"
      @close="selectedId = ''"
    />
  </main>
</template>

<style scoped>
.map-page {
  position: relative;
  height: 100dvh;
  overflow: hidden;
  transition: height var(--duration-normal);
}

.map-area {
  position: absolute;
  inset: 0;
  background: var(--color-map);
}

.map {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  user-select: none;
}

.map-header {
  position: absolute;
  top: calc(var(--screen-padding) + env(safe-area-inset-top));
  left: var(--screen-padding);
  right: var(--screen-padding);
  z-index: 5;
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.map-controls {
  position: absolute;
  right: var(--screen-padding);
  top: 38%;
  display: flex;
  flex-direction: column;
  padding: 3px;
  border-radius: var(--radius-pill);
}

.map-controls button {
  width: 36px;
  height: 38px;
  background: transparent;
}

.control-icon {
  width: 20px;
  height: 20px;
}

.hall-position {
  position: absolute;
  top: calc(100% - 66px - env(safe-area-inset-bottom));
  transition: top var(--duration-normal);
  left: 50%;
  transform: translateX(-50%);
  width: min(330px, calc(100% - 24px));
}

.has-selection .hall-position {
  top: calc(76px + env(safe-area-inset-top));
}

.sheet-position {
  position: absolute;
  z-index: 3;
  bottom: calc(var(--screen-padding) + env(safe-area-inset-bottom));
  left: var(--screen-padding);
  right: var(--screen-padding);
}

.toast {
  position: absolute;
  top: calc(140px + env(safe-area-inset-top));
  left: var(--screen-padding);
  right: var(--screen-padding);
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 13px;
}

.float-enter-active,
.float-leave-active {
  transition:
    opacity var(--duration-normal),
    transform var(--duration-normal);
}

.float-enter-from,
.float-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

.selected-booth {
  fill: var(--color-highlight);
  stroke: var(--color-primary);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

@media (width >= 700px) {
  .map-header {
    max-width: 440px;
  }

  .hall-position,
  .has-selection .hall-position {
    left: auto;
    right: 20px;
    top: 20px;
    transform: none;
  }

  .sheet-position {
    width: 380px;
  }
}
</style>
