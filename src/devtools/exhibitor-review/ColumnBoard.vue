<script setup lang="ts">
import { computed } from "vue";

import type { ReviewColumn } from "./review-data";

interface ReviewDraft {
  status: "confirmed" | "pending" | "unclear";
  value: string;
}

const props = defineProps<{
  columnIndex: number;
  columns: ReviewColumn[];
  drafts: Record<string, ReviewDraft>;
  missingIds: Set<string>;
  sourceUrls: string[];
  status: string;
  zoom: number;
}>();

const emit = defineEmits<{
  confirmColumn: [];
  edit: [id: string, value: string];
  openDetail: [id: string];
  selectColumn: [index: number];
  sourceFailed: [index: number];
  sourceLoaded: [index: number];
  toggleUnclear: [id: string];
  updateZoom: [value: number];
}>();

const column = computed(() => {
  return props.columns[props.columnIndex]!;
});
const confirmedCount = computed(() => {
  return column.value.rows.filter((row) => {
    return props.drafts[row.id]?.status === "confirmed";
  }).length;
});
const unclearCount = computed(() => {
  return column.value.rows.filter((row) => {
    return props.drafts[row.id]?.status === "unclear";
  }).length;
});

function editName(id: string, event: Event) {
  emit("edit", id, (event.target as HTMLInputElement).value);
}

function changeZoom(event: Event) {
  emit("updateZoom", Number((event.target as HTMLInputElement).value));
}

function confirmedInColumn(item: ReviewColumn) {
  return item.rows.filter((row) => {
    return props.drafts[row.id]?.status === "confirmed";
  }).length;
}
</script>

<template>
  <section class="column-review" aria-label="逐列校对">
    <div class="column-toolbar">
      <div>
        <label for="review-column">原图列</label>
        <select
          id="review-column"
          :value="columnIndex"
          @change="emit('selectColumn', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="(item, index) in columns" :key="item.label" :value="index">
            {{ item.label }}（{{ confirmedInColumn(item) }}/{{ item.rows.length }}）
          </option>
        </select>
      </div>
      <button :disabled="columnIndex === 0" @click="emit('selectColumn', columnIndex - 1)">
        上一列
      </button>
      <button
        :disabled="columnIndex === columns.length - 1"
        @click="emit('selectColumn', columnIndex + 1)"
      >
        下一列
      </button>
      <label class="zoom-control">
        放大 {{ zoom.toFixed(1) }}×
        <input :value="zoom" type="range" min="2" max="4" step="0.5" @input="changeZoom" />
      </label>
      <strong>{{ confirmedCount }} / {{ column.rows.length }} 已核对</strong>
      <span v-if="unclearCount">{{ unclearCount }} 条看不清</span>
      <button class="confirm-column" @click="emit('confirmColumn')">确认本列已核对</button>
    </div>

    <p class="instructions">
      从上到下对照原图与名称；只需修改错误项。整列看完后点击“确认本列已核对”，看不清的条目会保留待处理。
      已确认的 102 条会显示为“已核对”。
    </p>
    <p v-if="status" class="feedback" role="status">{{ status }}</p>

    <div class="column-scroll">
      <div
        class="source-column"
        :style="{
          width: `${column.width * zoom}px`,
          height: `${(column.bottom - column.y) * zoom}px`,
        }"
      >
        <img
          :src="sourceUrls[column.source]"
          :alt="column.label"
          :style="{
            width: `${800 * zoom}px`,
            left: `${-column.x * zoom}px`,
            top: `${-column.y * zoom}px`,
          }"
          @error="emit('sourceFailed', column.source)"
          @load="emit('sourceLoaded', column.source)"
        />
      </div>

      <div class="row-column" :style="{ height: `${(column.bottom - column.y) * zoom}px` }">
        <div
          v-for="row in column.rows"
          :id="`review-row-${row.id}`"
          :key="row.id"
          class="review-row"
          :class="`review-row-${drafts[row.id]?.status ?? 'pending'}`"
          :style="{
            top: `${(row.y - column.y) * zoom}px`,
            height: `${row.height * zoom}px`,
          }"
        >
          <span class="row-id">{{ row.id }}</span>
          <input
            :aria-label="`${row.id} 展商名称`"
            :placeholder="missingIds.has(row.id) ? '源码缺失' : ''"
            :value="drafts[row.id]?.value ?? ''"
            type="text"
            @input="editName(row.id, $event)"
          />
          <span class="row-status">
            {{
              drafts[row.id]?.status === "confirmed"
                ? "已核对"
                : drafts[row.id]?.status === "unclear"
                  ? "看不清"
                  : missingIds.has(row.id)
                    ? "源码缺失"
                    : "待核对"
            }}
          </span>
          <button
            :aria-label="`${row.id} ${drafts[row.id]?.status === 'unclear' ? '取消看不清' : '标记看不清'}`"
            :aria-pressed="drafts[row.id]?.status === 'unclear'"
            @click="emit('toggleUnclear', row.id)"
          >
            {{ drafts[row.id]?.status === "unclear" ? "取消标记" : "看不清" }}
          </button>
          <button :aria-label="`放大查看 ${row.id}`" @click="emit('openDetail', row.id)">
            放大
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.column-review {
  padding: 16px 20px 40px;
}

.column-toolbar {
  position: sticky;
  top: 78px;
  z-index: 5;
  display: flex;
  align-items: end;
  gap: 10px;
  padding: 12px 0;
  background: #eeeae3;
}

.column-toolbar > div,
.zoom-control {
  display: grid;
  gap: 4px;
}

.column-toolbar label,
.instructions {
  color: #665c51;
  font-size: 12px;
}

.column-toolbar strong {
  margin-left: auto;
}

.column-toolbar button,
.column-toolbar select,
.review-row button,
.review-row input {
  min-height: 30px;
  padding: 4px 7px;
  border: 1px solid #cfc4b7;
  border-radius: 6px;
  background: white;
  font: inherit;
}

.column-toolbar button,
.review-row button {
  cursor: pointer;
}

.review-row button {
  flex: none;
}

.column-toolbar button:disabled {
  cursor: default;
  opacity: 0.5;
}

.column-toolbar .confirm-column {
  border-color: #d85b24;
  color: white;
  background: #e66a2c;
}

.instructions {
  margin: 4px 0 14px;
}

.feedback {
  margin: 0 0 10px;
  color: #665c51;
  font-size: 12px;
}

.column-scroll {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  overflow: auto;
}

.source-column,
.row-column {
  position: relative;
  flex: none;
}

.source-column {
  overflow: hidden;
  border: 1px solid #71675d;
  background: white;
}

.source-column img {
  position: absolute;
  max-width: none;
}

.row-column {
  width: min(600px, 55vw);
  min-width: 520px;
}

.review-row {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  padding: 2px 5px;
  border-bottom: 1px solid #ded8cf;
  background: #fff8e9;
  font-size: 12px;
}

.review-row-confirmed {
  background: #edf6ed;
}

.review-row-unclear {
  background: #ffe6e1;
}

.row-id {
  flex: none;
  width: 82px;
  font-weight: 700;
}

.review-row input {
  flex: 1;
  min-width: 0;
}

.row-status {
  flex: none;
  width: 48px;
  color: #665c51;
}

@media (width <= 900px) {
  .column-toolbar {
    position: static;
    flex-wrap: wrap;
  }

  .column-toolbar strong {
    margin-left: 0;
  }
}
</style>
