<script setup lang="ts">
import { computed, nextTick, ref } from "vue";

import { booths, type Booth } from "../data/exhibition";
import { searchBooths } from "../domain/map";
import AppIcon from "./ui/AppIcon.vue";

const props = defineProps<{ preferredHall?: string }>();
const emit = defineEmits<{ select: [booth: Booth]; open: [value: boolean] }>();
const opened = ref(false);
const input = ref<HTMLInputElement>();
const trigger = ref<HTMLButtonElement>();
const query = ref("");
const results = computed(() => {
  return searchBooths(query.value, booths, props.preferredHall);
});
async function expand() {
  opened.value = true;
  emit("open", true);
  await nextTick();
  input.value?.focus();
}
async function close(restoreFocus = true) {
  input.value?.blur();
  opened.value = false;
  emit("open", false);
  await nextTick();
  if (restoreFocus) {
    trigger.value?.focus();
  }
}

function clearQuery() {
  query.value = "";
  input.value?.focus();
}

function choose(booth: Booth) {
  emit("select", booth);
  void close();
}
defineExpose({ close });
</script>

<template>
  <div class="map-search" @keydown.esc="close()">
    <button
      ref="trigger"
      v-if="!opened"
      class="ui-surface ui-icon-button"
      aria-label="搜索展商或展位"
      @click="expand"
    >
      <AppIcon name="search" />
    </button>
    <Transition name="search-expand">
      <div v-if="opened" class="search-panel">
        <form class="search-form ui-surface" role="search" @submit.prevent="input?.blur()">
          <input
            ref="input"
            v-model="query"
            aria-label="搜索展商或展位号"
            placeholder="搜索展商、拼音或展位号"
            enterkeyhint="search"
            autocomplete="off"
          />
          <button
            v-if="query"
            class="clear-query"
            type="button"
            aria-label="清除搜索内容"
            @pointerdown.prevent
            @click="clearQuery"
          >
            <AppIcon class="clear-icon" name="close" />
          </button>
          <button class="text-button" type="button" @click="close()">取消</button>
        </form>

        <section class="search-results ui-surface" aria-label="搜索结果">
          <p v-if="!query.trim()" class="muted">
            输入展商名称、拼音或展位号<br />目前可搜索 W5 展位
          </p>
          <p v-else-if="!results.length" class="muted" role="status">
            未找到匹配展位。当前可搜索 W5 展位。
          </p>
          <template v-else>
            <p class="muted" role="status">{{ results.length }} 个匹配展位</p>
            <ul>
              <li v-for="item in results" :key="item.id">
                <button @click="choose(item)">
                  <b>{{ item.hall }} · {{ item.code }}</b>
                  <span>{{ item.names.join(" / ") || "名称待补充" }}</span>
                  <span class="result-arrow" aria-hidden="true">›</span>
                </button>
              </li>
            </ul>
          </template>
        </section>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.map-search {
  position: relative;
  flex: 1;
  min-width: 0;
  height: var(--control-size);
  pointer-events: none;
}

.map-search > button {
  pointer-events: auto;
}

.search-panel {
  position: absolute;
  inset: 0 0 auto;
  pointer-events: auto;
  transform-origin: 24px 24px;
}

.search-expand-enter-active {
  transition:
    transform var(--duration-normal),
    opacity var(--duration-normal);
}

.search-expand-leave-active {
  pointer-events: none;
  transition:
    transform var(--duration-fast),
    opacity var(--duration-fast);
}

.search-expand-enter-from,
.search-expand-leave-to {
  opacity: 0;
  transform: scale(0.08);
}

.search-form {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  min-height: var(--control-size);
  border-radius: var(--radius-pill);
}

.search-form input {
  flex: 1;
  min-width: 0;
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--color-text);
  font-size: 16px;
  height: 44px;
}

.clear-query {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 32px;
  height: 44px;
  padding: 0;
  border-radius: var(--radius-pill);
  color: var(--color-muted);
  background: transparent;
}

.clear-icon {
  width: 18px;
  height: 18px;
}

.search-form:focus-within {
  box-shadow:
    var(--shadow-floating),
    0 0 0 2px var(--color-primary);
}

.search-form input:focus-visible {
  outline: none;
}

.search-form .text-button {
  flex-shrink: 0;
  min-height: 44px;
}

.search-results {
  margin-top: 10px;
  max-height: min(50dvh, 420px);
  overflow-y: auto;
  padding: 16px;
}

.search-results ul {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.search-results li + li {
  border-top: 1px solid var(--color-border);
}

.search-results li button {
  position: relative;
  width: 100%;
  min-height: 64px;
  text-align: left;
  background: transparent;
  padding: 12px 24px 12px 0;
}

.search-results b {
  display: block;
  font-size: 14px;
  color: var(--color-primary-ink);
}

.search-results span {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
}

.search-results .result-arrow {
  position: absolute;
  right: 0;
  top: 16px;
  font-size: 22px;
}
</style>
