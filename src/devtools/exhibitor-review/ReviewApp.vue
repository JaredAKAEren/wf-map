<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";

import { w1 } from "../../data/exhibition/w1";
import ColumnBoard from "./ColumnBoard.vue";
import {
  conflictEvidence,
  type CropRect,
  reviewColumns,
  reviewSources,
  sourceRowCrops,
} from "./review-data";
import { reviewedDecisions } from "./reviewed-decisions";

type ReviewKind = "blank" | "conflict" | "missing" | "unreviewed";
type ReviewStatus = "confirmed" | "pending" | "unclear";
type ReviewFilter = "all" | "pending" | "confirmed" | "unclear" | "unreviewed";

interface ReviewItem {
  crop: CropRect;
  current: string;
  id: string;
  kind: ReviewKind;
  note?: string;
  official?: string;
}

interface ReviewDraft {
  sourceValue: string;
  status: ReviewStatus;
  value: string;
}

interface CropOffset {
  x: number;
  y: number;
}

interface CropDragState extends CropOffset {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
}

const storageKey = "wf-map/exhibitor-review/w1/v3";
const previousStorageKey = "wf-map/exhibitor-review/w1/v2";
const legacyStorageKey = "wf-map/exhibitor-review/w1/v1";
const cropOffsetStorageKey = "wf-map/exhibitor-review/w1/crop-offsets/v1";
const columnStorageKey = "wf-map/exhibitor-review/w1/column/v2";
const currentNames = new Map<string, string>();
let cropDragState: CropDragState | undefined;

for (const booth of w1) {
  for (const entry of booth.entries) {
    currentNames.set(`W1-${booth.code}-${entry.slot}`, entry.names[0] ?? "");
  }
}

const items = Array.from(sourceRowCrops, ([id, crop]): ReviewItem => {
  const current = currentNames.get(id);
  const evidence = conflictEvidence[id];
  const reviewed = reviewedDecisions[id];

  if (current === undefined) {
    return {
      id,
      crop,
      current: "",
      kind: "missing",
      note: "原图存在该编号，但源码数组尚未覆盖到这里。",
    };
  }
  return {
    id,
    crop,
    current,
    kind: reviewed?.kind ?? "unreviewed",
    official: evidence?.official,
    note: reviewed ? "已按人工校对结果回填。" : undefined,
  };
});
const missingIds = new Set(
  items
    .filter((item) => {
      return item.kind === "missing";
    })
    .map((item) => {
      return item.id;
    }),
);
const drafts = ref<Record<string, ReviewDraft>>({});
const cropOffsets = ref<Record<string, CropOffset>>({});
const selectedId = ref(items[0]?.id ?? "");
const filter = ref<ReviewFilter>("pending");
const mode = ref<"columns" | "detail">("columns");
const columnIndex = ref(0);
const columnZoom = ref(2.5);
let returnId = "";
const query = ref("");
const zoom = ref(3.5);
const status = ref("");
const sourceUrls = ref(
  reviewSources.map((source) => {
    return source.localUrl;
  }),
);
const sourceAvailable = ref(
  reviewSources.map(() => {
    return true;
  }),
);

const selectedItem = computed(() => {
  return items.find((item) => {
    return item.id === selectedId.value;
  });
});
const selectedDraft = computed(() => {
  const item = selectedItem.value;

  return item ? drafts.value[item.id] : undefined;
});
const selectedCropOffset = computed(() => {
  return cropOffsets.value[selectedId.value] ?? { x: 0, y: 0 };
});
const visibleItems = computed(() => {
  const keyword = query.value.trim().toLowerCase();

  return items.filter((item) => {
    const draft = drafts.value[item.id];
    const matchesFilter =
      filter.value === "all" ||
      (filter.value === "unreviewed" ? item.kind === "unreviewed" : draft?.status === filter.value);
    const matchesQuery =
      !keyword ||
      item.id.toLowerCase().includes(keyword) ||
      item.current.toLowerCase().includes(keyword) ||
      item.official?.toLowerCase().includes(keyword) ||
      draft?.value.toLowerCase().includes(keyword);

    return Boolean(matchesFilter && matchesQuery);
  });
});
const confirmedCount = computed(() => {
  return items.filter((item) => {
    return drafts.value[item.id]?.status === "confirmed";
  }).length;
});
const unclearCount = computed(() => {
  return items.filter((item) => {
    return drafts.value[item.id]?.status === "unclear";
  }).length;
});
const exportText = computed(() => {
  return JSON.stringify(
    {
      hall: "W1",
      sourceRows: sourceRowCrops.size,
      reviewCount: items.length,
      decisions: items.map((item) => {
        const draft = drafts.value[item.id];

        return {
          id: item.id,
          kind: item.kind,
          current: item.current,
          officialCandidate: item.official,
          value: draft?.value ?? item.current,
          status: draft?.status ?? "pending",
        };
      }),
    },
    null,
    2,
  );
});

function initialDraft(item: ReviewItem): ReviewDraft {
  const reviewed = reviewedDecisions[item.id];

  return {
    sourceValue: item.current,
    value: item.current,
    status: reviewed?.value === item.current ? reviewed.status : "pending",
  };
}

function selectItem(id: string) {
  selectedId.value = id;
}

function useOfficial() {
  const item = selectedItem.value;
  if (!item?.official) {
    return;
  }
  drafts.value[item.id]!.value = item.official;
  drafts.value[item.id]!.status = "pending";
}

function confirmSelected() {
  const item = selectedItem.value;
  if (!item) {
    return;
  }
  if (!drafts.value[item.id]!.value.trim()) {
    drafts.value[item.id]!.status = "unclear";
    status.value = `${item.id} 没有名称，已标记看不清。`;
    selectNext();

    return;
  }
  drafts.value[item.id]!.status = "confirmed";
  status.value = `${item.id} 已确认。`;
  selectNext();
}

function markPending() {
  const item = selectedItem.value;
  if (!item) {
    return;
  }
  drafts.value[item.id]!.status = "unclear";
  status.value = `${item.id} 已标记看不清。`;
  selectNext();
}

function editName(id: string, value: string) {
  const draft = drafts.value[id];
  if (!draft) {
    return;
  }

  draft.value = value;
  draft.status = "pending";
}

function editSelected(event: Event) {
  const item = selectedItem.value;
  if (item) {
    editName(item.id, (event.target as HTMLInputElement).value);
  }
}

function toggleUnclear(id: string) {
  const draft = drafts.value[id];
  if (draft) {
    draft.status = draft.status === "unclear" ? "pending" : "unclear";
  }
}

function confirmColumn() {
  const column = reviewColumns[columnIndex.value]!;
  let confirmed = 0;

  for (const row of column.rows) {
    const draft = drafts.value[row.id];
    if (draft?.status === "pending" && draft.value.trim()) {
      draft.status = "confirmed";
      confirmed += 1;
    }
  }

  status.value = `${column.label} 新确认 ${confirmed} 条；看不清或空名称的条目保持待处理。`;
}

function openDetail(id: string) {
  returnId = id;
  selectedId.value = id;
  filter.value = "all";
  mode.value = "detail";
}

async function returnToColumns() {
  mode.value = "columns";
  await nextTick();
  if (returnId) {
    document.getElementById(`review-row-${returnId}`)?.scrollIntoView({ block: "center" });
    returnId = "";
  }
}

function selectColumn(index: number) {
  columnIndex.value = index;
  window.scrollTo({ top: 0 });
}

function selectNext() {
  const list = visibleItems.value;
  const index = items.findIndex((item) => {
    return item.id === selectedId.value;
  });
  const next =
    list.find((item) => {
      return items.indexOf(item) > index;
    }) ?? list[0];

  if (next) {
    selectedId.value = next.id;
  }
}

function selectPrevious() {
  const list = visibleItems.value;
  const index = items.findIndex((item) => {
    return item.id === selectedId.value;
  });
  const previous =
    list.findLast((item) => {
      return items.indexOf(item) < index;
    }) ?? list.at(-1);

  if (previous) {
    selectedId.value = previous.id;
  }
}

function setCropOffset(id: string, x: number, y: number) {
  cropOffsets.value[id] = { x, y };
}

function nudgeCrop(x: number, y: number) {
  const item = selectedItem.value;
  if (!item) {
    return;
  }
  const current = selectedCropOffset.value;

  setCropOffset(item.id, current.x + x, current.y + y);
}

function resetCropOffset() {
  const item = selectedItem.value;
  if (!item) {
    return;
  }

  setCropOffset(item.id, 0, 0);
}

function startCropDrag(event: PointerEvent) {
  const item = selectedItem.value;
  if (!item) {
    return;
  }
  const current = selectedCropOffset.value;

  cropDragState = {
    id: item.id,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    x: current.x,
    y: current.y,
  };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function moveCrop(event: PointerEvent) {
  if (!cropDragState || cropDragState.pointerId !== event.pointerId) {
    return;
  }

  setCropOffset(
    cropDragState.id,
    cropDragState.x + (event.clientX - cropDragState.startX) / zoom.value,
    cropDragState.y + (event.clientY - cropDragState.startY) / zoom.value,
  );
}

function stopCropDrag(event: PointerEvent) {
  if (!cropDragState || cropDragState.pointerId !== event.pointerId) {
    return;
  }

  (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  cropDragState = undefined;
}

function replaceSource(index: number, event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) {
    return;
  }
  const previous = sourceUrls.value[index];
  if (previous?.startsWith("blob:")) {
    URL.revokeObjectURL(previous);
  }
  sourceUrls.value[index] = URL.createObjectURL(file);
  sourceAvailable.value[index] = true;
}

function sourceFailed(index: number) {
  sourceAvailable.value[index] = false;
}

async function copyDecisions() {
  try {
    await navigator.clipboard.writeText(exportText.value);
    status.value = "校对 JSON 已复制。";
  } catch {
    status.value = "复制失败，请使用下载功能。";
  }
}

async function importDecisions(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }

  try {
    const parsed: unknown = JSON.parse(await file.text());
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("hall" in parsed) ||
      parsed.hall !== "W1" ||
      !("decisions" in parsed) ||
      !Array.isArray(parsed.decisions)
    ) {
      throw new Error("不是 W1 校对 JSON");
    }

    const updates = new Map<string, ReviewDraft>();
    for (const decision of parsed.decisions) {
      if (
        !decision ||
        typeof decision.id !== "string" ||
        !sourceRowCrops.has(decision.id) ||
        typeof decision.value !== "string" ||
        !["confirmed", "pending", "unclear"].includes(decision.status) ||
        updates.has(decision.id)
      ) {
        throw new Error("记录编号、名称或状态无效");
      }
      const current = currentNames.get(decision.id) ?? "";
      const sourceValue = typeof decision.current === "string" ? decision.current : current;
      const staleUnedited = sourceValue !== current && decision.value === sourceValue;
      updates.set(decision.id, {
        sourceValue: current,
        value: staleUnedited ? current : decision.value,
        status: staleUnedited ? "pending" : decision.status,
      });
    }

    for (const [id, draft] of updates) {
      drafts.value[id] = draft;
    }
    status.value = `已从 JSON 恢复 ${updates.size} 条记录。`;
  } catch (error) {
    status.value = `导入失败：${error instanceof Error ? error.message : "文件无法读取"}。`;
  } finally {
    input.value = "";
  }
}

function downloadDecisions() {
  const blob = new Blob([exportText.value], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "w1-exhibitor-review.json";
  anchor.click();
  URL.revokeObjectURL(url);
  status.value = "校对 JSON 已下载。";
}

function keydown(event: KeyboardEvent) {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      confirmSelected();
    }

    return;
  }
  if (event.key === "ArrowDown" || event.key === "j") {
    event.preventDefault();
    selectNext();
  } else if (event.key === "ArrowUp" || event.key === "k") {
    event.preventDefault();
    selectPrevious();
  } else if (event.key === "Enter") {
    event.preventDefault();
    confirmSelected();
  }
}

watch(
  drafts,
  (value) => {
    localStorage.setItem(storageKey, JSON.stringify(value));
  },
  { deep: true },
);

watch(
  cropOffsets,
  (value) => {
    localStorage.setItem(cropOffsetStorageKey, JSON.stringify(value));
  },
  { deep: true },
);

watch(columnIndex, (value) => {
  localStorage.setItem(columnStorageKey, String(value));
});

watch(visibleItems, (value) => {
  if (
    !value.some((item) => {
      return item.id === selectedId.value;
    })
  ) {
    selectedId.value = value[0]?.id ?? "";
  }
});

onMounted(() => {
  const savedV3 = localStorage.getItem(storageKey);
  const savedV2 = localStorage.getItem(previousStorageKey);
  const saved = savedV3 ?? savedV2 ?? localStorage.getItem(legacyStorageKey);
  const savedCropOffsets = localStorage.getItem(cropOffsetStorageKey);
  const savedColumn = Number(localStorage.getItem(columnStorageKey));

  for (const item of items) {
    drafts.value[item.id] = initialDraft(item);
  }
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as Record<string, ReviewDraft>;

      for (const item of items) {
        const draft = parsed[item.id];
        if (draft && typeof draft.value === "string") {
          const savedStatus = ["confirmed", "pending", "unclear"].includes(draft.status)
            ? draft.status
            : "pending";
          const sourceChanged =
            typeof draft.sourceValue === "string" && draft.sourceValue !== item.current;
          const staleUnedited = sourceChanged && draft.value === draft.sourceValue;
          drafts.value[item.id] = {
            sourceValue: item.current,
            value: staleUnedited ? item.current : draft.value,
            status:
              staleUnedited ||
              (!savedV2 && !savedV3 && savedStatus === "confirmed" && draft.value !== item.current)
                ? "pending"
                : savedStatus,
          };
        }
      }
      status.value = "已恢复本机校对进度。";
    } catch {
      status.value = "旧校对进度无法读取，已重新开始。";
    }
  }
  if (savedCropOffsets) {
    try {
      cropOffsets.value = JSON.parse(savedCropOffsets) as Record<string, CropOffset>;
    } catch {
      cropOffsets.value = {};
    }
  }
  if (Number.isInteger(savedColumn) && savedColumn >= 0 && savedColumn < reviewColumns.length) {
    columnIndex.value = savedColumn;
  }
});
</script>

<template>
  <main class="review" tabindex="-1" @keydown="keydown">
    <header class="toolbar">
      <div>
        <p class="eyebrow">仅供开发使用</p>
        <h1>W1 个人展商校对</h1>
      </div>
      <div class="summary">
        <strong>{{ confirmedCount }} / {{ items.length }}</strong>
        <span>已确认</span>
      </div>
      <label v-if="mode === 'detail'">
        裁图放大 {{ zoom.toFixed(1) }}×
        <input v-model.number="zoom" type="range" min="2" max="6" step="0.5" />
      </label>
      <div class="toolbar-actions">
        <button v-if="mode === 'detail'" @click="returnToColumns">逐列校对</button>
        <button v-else @click="mode = 'detail'">逐条放大</button>
        <label class="import-button">
          导入 JSON
          <input type="file" accept="application/json,.json" @change="importDecisions" />
        </label>
        <button @click="copyDecisions">复制 JSON</button>
        <button @click="downloadDecisions">下载 JSON</button>
      </div>
    </header>

    <section class="source-bar" aria-label="原图来源">
      <div v-for="(source, index) in reviewSources" :key="source.label" class="source-picker">
        <span>{{ source.label }}</span>
        <strong :class="{ unavailable: !sourceAvailable[index] }">
          {{ sourceAvailable[index] ? "已载入" : "请选择文件" }}
        </strong>
        <label>
          替换原图
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            @change="replaceSource(index, $event)"
          />
        </label>
      </div>
    </section>

    <ColumnBoard
      v-if="mode === 'columns'"
      :column-index="columnIndex"
      :columns="reviewColumns"
      :drafts="drafts"
      :missing-ids="missingIds"
      :source-urls="sourceUrls"
      :status="status"
      :zoom="columnZoom"
      @confirm-column="confirmColumn"
      @edit="editName"
      @open-detail="openDetail"
      @select-column="selectColumn"
      @source-failed="sourceFailed"
      @source-loaded="sourceAvailable[$event] = true"
      @toggle-unclear="toggleUnclear"
      @update-zoom="columnZoom = $event"
    />

    <div v-else class="layout">
      <aside class="sidebar">
        <div class="filters">
          <input v-model="query" type="search" placeholder="搜索编号或文本" />
          <select v-model="filter">
            <option value="pending">仅待确认</option>
            <option value="all">全部记录</option>
            <option value="confirmed">已核对（{{ confirmedCount }}）</option>
            <option value="unclear">看不清（{{ unclearCount }}）</option>
            <option value="unreviewed">原先未复核</option>
          </select>
        </div>
        <p class="scope-note">
          原图共 {{ sourceRowCrops.size }} 行；已确认的条目和看不清的条目按校对结果标记。
        </p>
        <div class="item-list">
          <button
            v-for="item in visibleItems"
            :key="item.id"
            :class="{
              active: item.id === selectedId,
              confirmed: drafts[item.id]?.status === 'confirmed',
            }"
            @click="selectItem(item.id)"
          >
            <span class="kind" :class="`kind-${item.kind}`">
              {{
                item.kind === "missing"
                  ? "源码缺失"
                  : item.kind === "unreviewed"
                    ? "待核对"
                    : "历史复核"
              }}
            </span>
            <strong>{{ item.id }}</strong>
            <span>{{ drafts[item.id]?.value || item.current || "未识别" }}</span>
          </button>
          <p v-if="visibleItems.length === 0" class="empty">当前筛选下没有待复核项。</p>
        </div>
      </aside>

      <section v-if="selectedItem && selectedDraft" class="workspace">
        <div class="workspace-heading">
          <div>
            <p class="eyebrow">{{ selectedDraft.status === "confirmed" ? "已核对" : "待核对" }}</p>
            <h2>{{ selectedItem.id }}</h2>
          </div>
          <div class="navigation">
            <button @click="selectPrevious">上一条</button>
            <button @click="selectNext">下一条</button>
          </div>
        </div>

        <div class="crop-shell">
          <div
            class="crop-frame"
            :style="{
              width: `${selectedItem.crop.width * zoom}px`,
              height: `${selectedItem.crop.height * zoom}px`,
            }"
            @pointercancel="stopCropDrag"
            @pointerdown="startCropDrag"
            @pointermove="moveCrop"
            @pointerup="stopCropDrag"
          >
            <img
              :src="sourceUrls[selectedItem.crop.source]"
              alt="展商原图局部裁切"
              draggable="false"
              :style="{
                width: `${800 * zoom}px`,
                left: `${(-selectedItem.crop.x + selectedCropOffset.x) * zoom}px`,
                top: `${(-selectedItem.crop.y + selectedCropOffset.y) * zoom}px`,
              }"
              @error="sourceFailed(selectedItem.crop.source)"
              @load="sourceAvailable[selectedItem.crop.source] = true"
            />
          </div>
        </div>
        <div class="crop-controls">
          <span>直接拖动图片，或每次微调 2px：</span>
          <button @click="nudgeCrop(-2, 0)">图片左移</button>
          <button @click="nudgeCrop(2, 0)">图片右移</button>
          <button @click="nudgeCrop(0, -2)">图片上移</button>
          <button @click="nudgeCrop(0, 2)">图片下移</button>
          <button @click="resetCropOffset">复位</button>
        </div>

        <div class="evidence-grid">
          <article>
            <p class="label">当前源码</p>
            <strong>{{ selectedItem.current || "未识别 / 未录入" }}</strong>
          </article>
          <article v-if="selectedItem.official">
            <p class="label">官网近似项（仅作参考）</p>
            <strong>{{ selectedItem.official }}</strong>
            <button @click="useOfficial">采用此文本</button>
          </article>
        </div>

        <p v-if="selectedItem.note" class="note">{{ selectedItem.note }}</p>

        <label class="editor">
          你确认的文本
          <input :value="selectedDraft.value" type="text" autofocus @input="editSelected" />
        </label>

        <div class="actions">
          <button class="secondary" @click="markPending">仍然看不清</button>
          <button class="primary" @click="confirmSelected">确认并下一条</button>
        </div>
        <p class="shortcut">
          Enter 确认；↑/↓ 或 K/J 切换；在输入框内按 Command/Ctrl + Enter 确认。
        </p>
        <p v-if="status" class="status" role="status">{{ status }}</p>
      </section>
      <section v-else class="workspace empty-workspace">
        <p>当前筛选下没有待复核项。</p>
      </section>
    </div>
  </main>
</template>

<style scoped>
.review {
  min-height: 100vh;
  color: #231f1a;
  background: #eeeae3;
  outline: none;
}

.toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 28px;
  min-height: 78px;
  padding: 10px 20px;
  border-bottom: 1px solid #d8d0c5;
  background: rgb(255 253 249 / 96%);
  box-shadow: 0 4px 18px rgb(64 48 31 / 8%);
}

.toolbar h1,
.workspace h2 {
  margin: 0;
}

.eyebrow,
.label {
  margin: 0 0 3px;
  color: #776b5e;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.toolbar label {
  display: grid;
  gap: 5px;
  color: #665c51;
  font-size: 12px;
  font-weight: 700;
}

.summary {
  display: grid;
}

.summary strong {
  font-size: 20px;
}

.summary span {
  color: #776b5e;
  font-size: 12px;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

button,
select,
input {
  font: inherit;
}

button {
  min-height: 36px;
  padding: 7px 12px;
  border: 1px solid #cfc4b7;
  border-radius: 8px;
  color: #322a22;
  background: white;
  cursor: pointer;
}

.import-button {
  display: flex;
  align-items: center;
  min-height: 36px;
  padding: 7px 12px;
  border: 1px solid #cfc4b7;
  border-radius: 8px;
  background: white;
  cursor: pointer;
}

.import-button input {
  width: 1px;
  height: 1px;
  opacity: 0;
}

.source-bar {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  border-bottom: 1px solid #d8d0c5;
  background: #d8d0c5;
}

.source-picker {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 3px 10px;
  padding: 8px 14px;
  background: #faf7f2;
  font-size: 12px;
}

.source-picker strong {
  color: #3d7d54;
}

.source-picker strong.unavailable {
  color: #b14d3b;
}

.source-picker label {
  grid-column: 1 / -1;
  color: #75695d;
  cursor: pointer;
}

.source-picker input {
  width: 1px;
  height: 1px;
  opacity: 0;
}

.layout {
  display: grid;
  grid-template-columns: 330px minmax(0, 1fr);
  min-height: calc(100vh - 132px);
}

.sidebar {
  border-right: 1px solid #d8d0c5;
  background: #faf8f4;
}

.filters {
  display: grid;
  gap: 8px;
  padding: 14px;
}

.filters input,
.filters select,
.editor input {
  min-height: 40px;
  padding: 8px 10px;
  border: 1px solid #cfc4b7;
  border-radius: 8px;
  color: #251f18;
  background: white;
}

.scope-note {
  margin: 0;
  padding: 0 14px 12px;
  color: #6c6258;
  font-size: 12px;
  line-height: 1.55;
}

.item-list {
  max-height: calc(100vh - 260px);
  overflow: auto;
  padding: 0 10px 16px;
}

.item-list button {
  display: grid;
  grid-template-columns: auto 1fr;
  width: 100%;
  margin-bottom: 6px;
  text-align: left;
}

.item-list button > span:last-child {
  grid-column: 2;
  overflow: hidden;
  color: #71675d;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-list button.active {
  border-color: #e66a2c;
  box-shadow: 0 0 0 2px rgb(230 106 44 / 18%);
}

.item-list button.confirmed {
  opacity: 0.55;
}

.kind {
  align-self: center;
  padding: 2px 5px;
  border-radius: 999px;
  color: white;
  font-size: 10px;
}

.kind-missing {
  background: #b44735;
}

.kind-blank {
  background: #9b6b22;
}

.kind-conflict {
  background: #6f57a5;
}

.workspace {
  min-width: 0;
  padding: 28px 34px 48px;
}

.workspace-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.navigation,
.actions,
.evidence-grid article {
  display: flex;
  gap: 8px;
}

.crop-shell {
  overflow: auto;
  padding: 18px;
  border: 1px solid #d7cec1;
  border-radius: 12px;
  background: #d9d2c8;
}

.crop-frame {
  position: relative;
  overflow: hidden;
  max-width: none;
  border: 2px solid #27211c;
  background: #f4f0e9;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.crop-frame:active {
  cursor: grabbing;
}

.crop-frame img {
  position: absolute;
  max-width: none;
  image-rendering: auto;
  pointer-events: none;
}

.crop-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  color: #6c6258;
  font-size: 12px;
}

.crop-controls button {
  min-height: 30px;
  padding: 4px 8px;
}

.evidence-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.evidence-grid article {
  align-items: center;
  justify-content: space-between;
  min-height: 66px;
  padding: 12px 14px;
  border: 1px solid #ddd3c7;
  border-radius: 10px;
  background: white;
}

.evidence-grid article > div {
  min-width: 0;
}

.note {
  padding: 10px 12px;
  border-left: 3px solid #d88935;
  color: #694c2d;
  background: #fff4df;
}

.editor {
  display: grid;
  gap: 7px;
  margin-top: 18px;
  color: #665c51;
  font-size: 13px;
  font-weight: 700;
}

.editor input {
  min-height: 48px;
  font-size: 18px;
}

.actions {
  justify-content: flex-end;
  margin-top: 16px;
}

.actions .primary {
  border-color: #d85b24;
  color: white;
  background: #e66a2c;
}

.shortcut,
.status,
.empty {
  color: #73695f;
  font-size: 12px;
}

.shortcut,
.status {
  text-align: right;
}

.empty-workspace {
  display: grid;
  place-items: center;
  color: #71675d;
}

@media (width <= 900px) {
  .toolbar {
    position: static;
    flex-wrap: wrap;
  }

  .toolbar-actions {
    margin-left: 0;
  }

  .source-bar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .layout {
    grid-template-columns: 1fr;
  }

  .sidebar {
    border-right: 0;
    border-bottom: 1px solid #d8d0c5;
  }

  .item-list {
    max-height: 280px;
  }

  .workspace {
    padding: 20px 14px 40px;
  }

  .crop-controls {
    flex-wrap: wrap;
  }

  .evidence-grid {
    grid-template-columns: 1fr;
  }
}
</style>
