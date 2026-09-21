<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";

import { booths, halls, isHall, type Booth } from "../../data/exhibition";
import {
  adjustBounds,
  constrainBounds,
  type Bounds,
  type DragOperation,
  type SurfaceSize,
} from "./geometry";

type CoordinateMap = Record<string, Bounds>;

interface HistoryEntry {
  before: CoordinateMap;
  after: CoordinateMap;
}

interface DragState {
  pointerId: number;
  operation: DragOperation;
  origin: { x: number; y: number };
  source: Bounds;
  before: CoordinateMap;
}

const handleDefinitions: { operation: Exclude<DragOperation, "move">; x: number; y: number }[] = [
  { operation: "nw", x: 0, y: 0 },
  { operation: "n", x: 0.5, y: 0 },
  { operation: "ne", x: 1, y: 0 },
  { operation: "e", x: 1, y: 0.5 },
  { operation: "se", x: 1, y: 1 },
  { operation: "s", x: 0.5, y: 1 },
  { operation: "sw", x: 0, y: 1 },
  { operation: "w", x: 0, y: 0.5 },
];
const query = new URLSearchParams(window.location.search);
const requestedHall = query.get("hall")?.toUpperCase();
const initialHall = isHall(requestedHall) ? requestedHall : "W5";
const selectedHall = ref(initialHall);
const selectedId = ref("");
const coordinates = ref<CoordinateMap>({});
const zoom = ref(0.8);
const showOverlay = ref(true);
const status = ref("");
const pointerPosition = ref<{ x: number; y: number }>();
const svg = ref<SVGSVGElement>();
const workspace = ref<HTMLElement>();
const drag = ref<DragState>();
const undoStack = ref<HistoryEntry[]>([]);
const redoStack = ref<HistoryEntry[]>([]);

const hallBooths = computed(() => {
  return booths.filter((booth) => {
    return booth.hall === selectedHall.value;
  });
});
const surface = computed<SurfaceSize>(() => {
  return { width: 800, height: selectedHall.value === "W1" ? 1500 : 1480 };
});
const selectedBooth = computed(() => {
  return hallBooths.value.find((booth) => {
    return booth.id === selectedId.value;
  });
});
const selectedBounds = computed(() => {
  return selectedId.value ? coordinates.value[selectedId.value] : undefined;
});
const originalBounds = computed(() => {
  return selectedBooth.value ? boundsOf(selectedBooth.value) : undefined;
});
const changedCount = computed(() => {
  return hallBooths.value.filter((booth) => {
    return !sameBounds(coordinates.value[booth.id], boundsOf(booth));
  }).length;
});
const exportText = computed(() => {
  return JSON.stringify(
    {
      hall: selectedHall.value,
      imageSize: surface.value,
      booths: hallBooths.value.map((booth) => {
        return { code: booth.code, ...coordinates.value[booth.id] };
      }),
    },
    null,
    2,
  );
});

function boundsOf(booth: Booth): Bounds {
  return { x: booth.x, y: booth.y, width: booth.width, height: booth.height };
}

function cloneCoordinates(value: CoordinateMap): CoordinateMap {
  return Object.fromEntries(
    Object.entries(value).map(([id, bounds]) => {
      return [id, { ...bounds }];
    }),
  );
}

function sameBounds(left: Bounds | undefined, right: Bounds | undefined) {
  return Boolean(
    left &&
    right &&
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height,
  );
}

function originalCoordinates(): CoordinateMap {
  return Object.fromEntries(
    hallBooths.value.map((booth) => {
      return [booth.id, boundsOf(booth)];
    }),
  );
}

function storageKey() {
  return `wf-map/booth-calibration/v1/${selectedHall.value}`;
}

function persist() {
  const original = originalCoordinates();

  if (JSON.stringify(coordinates.value) === JSON.stringify(original)) {
    localStorage.removeItem(storageKey());

    return;
  }
  localStorage.setItem(
    storageKey(),
    JSON.stringify({ source: original, coordinates: coordinates.value }),
  );
}

function loadHall() {
  const original = originalCoordinates();
  const saved = localStorage.getItem(storageKey());
  selectedId.value = hallBooths.value[0]?.id ?? "";
  undoStack.value = [];
  redoStack.value = [];
  coordinates.value = original;
  status.value = "";

  if (!saved) {
    return;
  }
  try {
    const parsed = JSON.parse(saved) as { source?: CoordinateMap; coordinates?: CoordinateMap };
    if (
      parsed.coordinates &&
      typeof parsed.coordinates === "object" &&
      JSON.stringify(parsed.coordinates) === JSON.stringify(original)
    ) {
      status.value = "源码坐标已与校对草稿一致。";
    } else if (
      JSON.stringify(parsed.source) === JSON.stringify(original) &&
      parsed.coordinates &&
      typeof parsed.coordinates === "object"
    ) {
      coordinates.value = parsed.coordinates;
      status.value = "已恢复本机校对草稿。";
    } else {
      status.value = "源码坐标已经变化，旧草稿未自动载入。";
    }
  } catch {
    status.value = "本机草稿无法读取，已使用源码坐标。";
  }
}

function changeHall() {
  const url = new URL(window.location.href);
  url.searchParams.set("hall", selectedHall.value);
  window.history.replaceState(null, "", url);
  loadHall();
}

function applySnapshot(next: CoordinateMap, before = coordinates.value) {
  const previous = cloneCoordinates(before);
  const after = cloneCoordinates(next);

  if (JSON.stringify(previous) === JSON.stringify(after)) {
    return;
  }
  undoStack.value.push({ before: previous, after });
  redoStack.value = [];
  coordinates.value = after;
  persist();
}

function updateSelected(next: Bounds) {
  if (!selectedId.value) {
    return;
  }
  applySnapshot({
    ...coordinates.value,
    [selectedId.value]: constrainBounds(next, surface.value),
  });
}

function selectBooth(id: string) {
  selectedId.value = id;
  void nextTick(() => {
    workspace.value?.focus({ preventScroll: true });
  });
}

function clearSelection() {
  selectedId.value = "";
  void nextTick(() => {
    workspace.value?.focus({ preventScroll: true });
  });
}

function worldPoint(event: PointerEvent) {
  const element = svg.value;
  const matrix = element?.getScreenCTM();
  if (!element || !matrix) {
    return;
  }
  const point = element.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const transformed = point.matrixTransform(matrix.inverse());

  return { x: transformed.x, y: transformed.y };
}

function beginDrag(event: PointerEvent, id: string, operation: DragOperation) {
  const origin = worldPoint(event);
  const source = coordinates.value[id];
  if (!origin || !source) {
    return;
  }
  selectBooth(id);
  svg.value?.setPointerCapture(event.pointerId);
  drag.value = {
    pointerId: event.pointerId,
    operation,
    origin,
    source: { ...source },
    before: cloneCoordinates(coordinates.value),
  };
}

function movePointer(event: PointerEvent) {
  const point = worldPoint(event);
  if (!point) {
    return;
  }
  pointerPosition.value = { x: Math.round(point.x), y: Math.round(point.y) };
  const active = drag.value;
  if (!active || event.pointerId !== active.pointerId || !selectedId.value) {
    return;
  }
  coordinates.value = {
    ...coordinates.value,
    [selectedId.value]: adjustBounds(
      active.source,
      active.operation,
      { x: point.x - active.origin.x, y: point.y - active.origin.y },
      surface.value,
    ),
  };
}

function finishDrag(event: PointerEvent) {
  const active = drag.value;
  if (!active || event.pointerId !== active.pointerId) {
    return;
  }
  svg.value?.releasePointerCapture(event.pointerId);
  drag.value = undefined;
  applySnapshot(coordinates.value, active.before);
}

function cancelDrag(event: PointerEvent) {
  const active = drag.value;
  if (!active || event.pointerId !== active.pointerId) {
    return;
  }
  coordinates.value = active.before;
  drag.value = undefined;
}

function changeField(field: keyof Bounds, event: Event) {
  const bounds = selectedBounds.value;
  const value = Number((event.target as HTMLInputElement).value);
  if (!bounds || !Number.isFinite(value)) {
    return;
  }
  updateSelected({ ...bounds, [field]: value });
}

function undo() {
  const entry = undoStack.value.pop();
  if (!entry) {
    return;
  }
  redoStack.value.push(entry);
  coordinates.value = cloneCoordinates(entry.before);
  persist();
}

function redo() {
  const entry = redoStack.value.pop();
  if (!entry) {
    return;
  }
  undoStack.value.push(entry);
  coordinates.value = cloneCoordinates(entry.after);
  persist();
}

function resetSelected() {
  const original = originalBounds.value;
  if (original) {
    updateSelected(original);
  }
}

function resetAll() {
  applySnapshot(originalCoordinates());
  status.value = "已恢复本馆全部源码坐标。";
}

function keydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    clearSelection();

    return;
  }
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) {
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (event.shiftKey) {
      redo();
    } else {
      undo();
    }

    return;
  }
  const bounds = selectedBounds.value;
  if (!bounds || !event.key.startsWith("Arrow")) {
    return;
  }
  event.preventDefault();
  const step = event.shiftKey ? 5 : 1;
  const delta = {
    x: event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0,
    y: event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0,
  };
  updateSelected(adjustBounds(bounds, "move", delta, surface.value));
}

async function copyCoordinates() {
  try {
    await navigator.clipboard.writeText(exportText.value);
    status.value = "坐标 JSON 已复制。";
  } catch {
    status.value = "复制失败，请使用下载功能导出。";
  }
}

function downloadCoordinates() {
  const blob = new Blob([exportText.value], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${selectedHall.value.toLowerCase()}-booth-bounds.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  status.value = "坐标 JSON 已下载。";
}

onMounted(() => {
  loadHall();
  workspace.value?.focus();
});
</script>

<template>
  <main ref="workspace" class="calibration" tabindex="-1" @keydown="keydown">
    <header class="toolbar">
      <div>
        <p class="eyebrow">仅供开发使用</p>
        <h1>展位边界校对</h1>
      </div>
      <label>
        展馆
        <select v-model="selectedHall" @change="changeHall">
          <option v-for="hall in halls" :key="hall" :value="hall">{{ hall }}</option>
        </select>
      </label>
      <label>
        显示比例 {{ Math.round(zoom * 100) }}%
        <input v-model.number="zoom" type="range" min="0.4" max="1.6" step="0.1" />
      </label>
      <label class="overlay-toggle">
        <input v-model="showOverlay" type="checkbox" />
        显示覆盖层
      </label>
      <div class="toolbar-actions">
        <button :disabled="undoStack.length === 0" @click="undo">撤销</button>
        <button :disabled="redoStack.length === 0" @click="redo">重做</button>
        <button @click="copyCoordinates">复制坐标</button>
        <button @click="downloadCoordinates">下载 JSON</button>
      </div>
    </header>

    <div class="layout">
      <section class="map-panel" aria-label="边界校对画布">
        <div class="map-scroll">
          <svg
            ref="svg"
            class="map"
            :style="{ width: `${surface.width * zoom}px` }"
            :viewBox="`0 0 ${surface.width} ${surface.height}`"
            @pointermove="movePointer"
            @pointerup="finishDrag"
            @pointercancel="cancelDrag"
            @lostpointercapture="cancelDrag"
          >
            <image
              :href="`/maps/${selectedHall}.png`"
              :width="surface.width"
              :height="surface.height"
              @pointerdown.prevent="clearSelection"
            />
            <g v-if="showOverlay">
              <g v-for="booth in hallBooths" :key="booth.id">
                <rect
                  v-if="coordinates[booth.id]"
                  class="booth-boundary"
                  :class="{
                    selected: booth.id === selectedId,
                    changed: !sameBounds(coordinates[booth.id], boundsOf(booth)),
                  }"
                  :x="coordinates[booth.id]?.x"
                  :y="coordinates[booth.id]?.y"
                  :width="coordinates[booth.id]?.width"
                  :height="coordinates[booth.id]?.height"
                  rx="8"
                  @pointerdown.stop.prevent="beginDrag($event, booth.id, 'move')"
                />
                <text
                  v-if="coordinates[booth.id]"
                  class="booth-label"
                  :x="(coordinates[booth.id]?.x ?? 0) + 5"
                  :y="(coordinates[booth.id]?.y ?? 0) + 16"
                >
                  {{ booth.code }}
                </text>
              </g>
              <template v-if="selectedBounds && originalBounds">
                <rect
                  v-if="!sameBounds(selectedBounds, originalBounds)"
                  class="original-boundary"
                  :x="originalBounds.x"
                  :y="originalBounds.y"
                  :width="originalBounds.width"
                  :height="originalBounds.height"
                  rx="8"
                />
                <rect
                  v-for="handle in handleDefinitions"
                  :key="handle.operation"
                  class="resize-handle"
                  :class="`handle-${handle.operation}`"
                  :x="selectedBounds.x + selectedBounds.width * handle.x - 5"
                  :y="selectedBounds.y + selectedBounds.height * handle.y - 5"
                  width="10"
                  height="10"
                  rx="2"
                  @pointerdown.stop.prevent="beginDrag($event, selectedId, handle.operation)"
                />
              </template>
            </g>
          </svg>
        </div>
      </section>

      <aside class="side-panel">
        <section class="summary">
          <h2>{{ selectedHall }}</h2>
          <p>{{ hallBooths.length }} 个展位，{{ changedCount }} 个已调整</p>
          <p v-if="pointerPosition" class="pointer-position">
            光标：{{ pointerPosition.x }}, {{ pointerPosition.y }}
          </p>
          <p v-if="status" class="status" role="status">{{ status }}</p>
        </section>

        <section v-if="selectedBooth && selectedBounds" class="editor">
          <div class="editor-heading">
            <div>
              <p class="eyebrow">当前展位</p>
              <h2>{{ selectedBooth.code }}</h2>
            </div>
            <div class="editor-actions">
              <button @click="clearSelection">取消选中</button>
              <button :disabled="sameBounds(selectedBounds, originalBounds)" @click="resetSelected">
                恢复当前
              </button>
            </div>
          </div>
          <p class="booth-name">
            {{
              selectedBooth.entries
                .flatMap((entry) => {
                  return entry.names;
                })
                .join("、")
            }}
          </p>
          <div class="coordinate-grid">
            <label v-for="field in ['x', 'y', 'width', 'height'] as const" :key="field">
              {{ field }}
              <input
                type="number"
                :value="selectedBounds[field]"
                step="1"
                @change="changeField(field, $event)"
              />
            </label>
          </div>
          <p class="hint">拖动框移动；拖动八个控制点缩放；方向键微调，Shift + 方向键移动 5px。</p>
        </section>
        <section v-else class="selection-empty">
          <p>未选中展位。点击边框或右侧列表继续校对。</p>
        </section>

        <section class="booth-list">
          <button
            v-for="booth in hallBooths"
            :key="booth.id"
            :class="{
              active: booth.id === selectedId,
              changed: !sameBounds(coordinates[booth.id], boundsOf(booth)),
            }"
            @click="selectBooth(booth.id)"
          >
            <strong>{{ booth.code }}</strong>
            <span>{{ coordinates[booth.id]?.x }}, {{ coordinates[booth.id]?.y }}</span>
          </button>
          <p v-if="hallBooths.length === 0" class="empty">本馆尚未录入展位数据。</p>
        </section>

        <button class="reset-all" :disabled="changedCount === 0" @click="resetAll">
          恢复本馆全部源码坐标
        </button>
      </aside>
    </div>
  </main>
</template>

<style scoped>
.calibration {
  min-height: 100vh;
  color: #251f18;
  background: #e9e5de;
  outline: none;
}

.toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 24px;
  min-height: 76px;
  padding: 10px 18px;
  border-bottom: 1px solid #d7cfc4;
  background: rgb(255 253 249 / 96%);
  box-shadow: 0 4px 16px rgb(62 46 28 / 8%);
}

.toolbar h1 {
  font-size: 20px;
}

.eyebrow {
  margin-bottom: 2px;
  color: #776b5e;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.toolbar label,
.coordinate-grid label {
  display: grid;
  gap: 5px;
  color: #665b50;
  font-size: 12px;
  font-weight: 700;
}

select,
input[type="number"] {
  min-height: 36px;
  padding: 6px 9px;
  border: 1px solid #cfc5b8;
  border-radius: 8px;
  color: #251f18;
  background: white;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.toolbar .overlay-toggle {
  display: flex;
  grid-template-columns: none;
  align-items: center;
  gap: 7px;
  min-height: 36px;
  padding: 0 10px;
  border: 1px solid #cfc5b8;
  border-radius: 8px;
  background: white;
  cursor: pointer;
}

.overlay-toggle input {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: #e36b00;
}

button {
  min-height: 36px;
  padding: 7px 12px;
  border: 1px solid #cfc5b8;
  border-radius: 8px;
  background: white;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  min-height: calc(100vh - 76px);
}

.map-panel {
  min-width: 0;
  padding: 24px;
}

.map-scroll {
  height: calc(100vh - 124px);
  overflow: auto;
  border: 1px solid #cfc5b8;
  border-radius: 12px;
  background: #bcb7af;
  box-shadow: 0 12px 32px rgb(56 44 31 / 12%);
}

.map {
  display: block;
  height: auto;
  margin: 0 auto;
  background: white;
  touch-action: none;
  user-select: none;
}

.booth-boundary {
  cursor: move;
  fill: rgb(0 152 255 / 12%);
  stroke: #0077c8;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.booth-boundary:hover,
.booth-boundary.selected {
  fill: rgb(244 152 15 / 22%);
  stroke: #e36b00;
  stroke-width: 1;
}

.booth-boundary.changed:not(.selected) {
  stroke: #c42929;
}

.booth-label {
  pointer-events: none;
  fill: #003a61;
  font-size: 13px;
  font-weight: 800;
  paint-order: stroke;
  stroke: white;
  stroke-width: 3px;
  stroke-linejoin: round;
}

.original-boundary {
  pointer-events: none;
  fill: none;
  stroke: #5b5147;
  stroke-dasharray: 5 4;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.resize-handle {
  fill: white;
  stroke: #c75000;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.handle-n,
.handle-s {
  cursor: ns-resize;
}

.handle-e,
.handle-w {
  cursor: ew-resize;
}

.handle-ne,
.handle-sw {
  cursor: nesw-resize;
}

.handle-nw,
.handle-se {
  cursor: nwse-resize;
}

.side-panel {
  position: sticky;
  top: 76px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: calc(100vh - 76px);
  padding: 18px;
  overflow: auto;
  border-left: 1px solid #d7cfc4;
  background: #fffdf9;
}

.summary,
.editor {
  display: grid;
  gap: 8px;
  padding-bottom: 14px;
  border-bottom: 1px solid #e5ded4;
}

.summary > p,
.booth-name,
.hint,
.empty {
  color: #776b5e;
  font-size: 13px;
  line-height: 1.5;
}

.summary .pointer-position {
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.summary .status {
  color: #925000;
}

.editor-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.editor-actions {
  display: flex;
  gap: 6px;
}

.selection-empty {
  padding-bottom: 14px;
  border-bottom: 1px solid #e5ded4;
  color: #776b5e;
  font-size: 13px;
}

.coordinate-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.coordinate-grid input {
  width: 100%;
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.booth-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.booth-list button {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 7px;
  text-align: left;
}

.booth-list button.active {
  border-color: #e36b00;
  background: #fff0d9;
}

.booth-list button.changed strong::after {
  color: #c42929;
  content: " *";
}

.booth-list span {
  overflow: hidden;
  color: #776b5e;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reset-all {
  margin-top: auto;
  color: #9b2222;
}

button:hover:not(:disabled) {
  border-color: #f4980f;
}

@media (width < 900px) {
  .toolbar {
    position: static;
    flex-wrap: wrap;
  }

  .toolbar-actions {
    width: 100%;
    margin-left: 0;
    overflow-x: auto;
  }

  .layout {
    grid-template-columns: 1fr;
  }

  .map-panel {
    padding: 12px;
  }

  .map-scroll {
    height: 70vh;
  }

  .side-panel {
    position: static;
    height: auto;
    border-top: 1px solid #d7cfc4;
    border-left: 0;
  }
}
</style>
