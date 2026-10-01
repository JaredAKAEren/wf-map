<script setup lang="ts">
import {
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxRoot,
  ComboboxViewport,
} from "reka-ui";
import { computed, nextTick, ref, watch } from "vue";

import { booths, type Booth, type Hall } from "../data/exhibition";
import { filterBooths, type BoothFilters } from "../domain/booth-filter";
import type { BoothSearchResult } from "../domain/map";
import SearchFilters from "./SearchFilters.vue";
import AppIcon from "./ui/AppIcon.vue";

const props = defineProps<{
  preferredHall?: Hall;
  photoIds: ReadonlySet<string>;
  favoriteIds: ReadonlySet<string>;
  photosReady: boolean;
  favoritesReady: boolean;
}>();
const emit = defineEmits<{ select: [booth: Booth]; open: [value: boolean] }>();

const opened = ref(false);
const input = ref<{ $el: HTMLInputElement }>();
const resultViewport = ref<{ $el: HTMLElement }>();
const trigger = ref<HTMLButtonElement>();
const query = ref("");
const filters = ref<BoothFilters>({ photos: false, favorites: false });
const hasHiddenResultsAbove = ref(false);
const hasHiddenResultsBelow = ref(false);
const results = computed(() => {
  return filterBooths(
    query.value,
    booths,
    filters.value,
    props.photoIds,
    props.favoriteIds,
    props.preferredHall,
  );
});
const filtering = computed(() => {
  return filters.value.photos || filters.value.favorites;
});

function inputElement() {
  return input.value?.$el;
}

async function expand() {
  opened.value = true;
  emit("open", true);
  await nextTick();
  inputElement()?.focus();
}

async function close(restoreFocus = true) {
  inputElement()?.blur();
  opened.value = false;
  emit("open", false);
  await nextTick();
  if (restoreFocus) {
    trigger.value?.focus();
  }
}

function clearQuery() {
  query.value = "";
  inputElement()?.focus();
}

function resultCode(result: BoothSearchResult) {
  const slot = result.entry?.slot;

  return slot ? `${result.booth.code}-${slot}` : result.booth.code;
}

function resultSummary(result: BoothSearchResult) {
  if (result.entry) {
    return result.entry.names.join(" / ") || "名称待补充";
  }

  const personalCount = result.booth.entries.filter((entry) => {
    return entry.slot;
  }).length;
  if (personalCount) {
    return `${personalCount} 个个人展商`;
  }

  return (
    result.booth.entries
      .flatMap((entry) => {
        return entry.names;
      })
      .join(" / ") || "名称待补充"
  );
}

function resultTextValue(result: BoothSearchResult) {
  return `${result.booth.hall} ${resultCode(result)} ${resultSummary(result)}`;
}

function resultKey(result: BoothSearchResult) {
  return `${result.booth.id}/${result.entry?.slot ?? (result.entry ? "entry" : "region")}`;
}

function updateResultFades(event?: Event) {
  const eventTarget = event?.currentTarget as HTMLElement | null;
  const element = eventTarget ?? resultViewport.value?.$el;
  if (!element) {
    hasHiddenResultsAbove.value = false;
    hasHiddenResultsBelow.value = false;

    return;
  }

  const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
  hasHiddenResultsAbove.value = element.scrollTop > 1;
  hasHiddenResultsBelow.value = maxScrollTop - element.scrollTop > 1;
}

function choose(result: BoothSearchResult) {
  emit("select", result.booth);
  void close();
}

function handleComboboxOpen(value: boolean) {
  if (!value && opened.value) {
    void close();
  }
}

watch([opened, results], async () => {
  await nextTick();
  const element = resultViewport.value?.$el;
  if (element) {
    element.scrollTop = 0;
  }

  requestAnimationFrame(() => {
    updateResultFades();
  });
});

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
        <ComboboxRoot
          class="search-combobox"
          :open="opened"
          :ignore-filter="true"
          :reset-search-term-on-blur="false"
          :reset-search-term-on-select="false"
          @update:open="handleComboboxOpen"
        >
          <form
            class="search-form ui-surface"
            role="search"
            @submit.prevent="inputElement()?.blur()"
          >
            <ComboboxInput ref="input" v-model="query" auto-focus as-child>
              <input
                aria-label="搜索展商或展位号"
                placeholder="搜索展商、拼音或展位号"
                enterkeyhint="search"
                autocomplete="off"
              />
            </ComboboxInput>
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
            <button class="ui-text-button" type="button" @click="close()">取消</button>
          </form>

          <SearchFilters
            v-model="filters"
            class="search-filter-position"
            :photos-ready="photosReady"
            :favorites-ready="favoritesReady"
          />

          <ComboboxContent
            as="section"
            class="search-results ui-surface"
            aria-label="搜索结果"
            @pointer-down-outside.prevent
            @focus-outside.prevent
            @interact-outside.prevent
          >
            <p v-if="!query.trim() && !filtering" class="ui-muted">
              输入展商名称、拼音或展位号<br />目前可搜索 W1—W5 展位
            </p>
            <p v-else-if="!results.length" class="ui-muted" role="status">
              {{
                filtering
                  ? "没有符合筛选条件的展位，可调整筛选或搜索内容。"
                  : "未找到匹配展位。当前可搜索 W1—W5 展位。"
              }}
            </p>
            <template v-else>
              <p class="ui-muted" role="status">{{ results.length }} 个匹配展位</p>
              <ComboboxViewport ref="resultViewport" as-child>
                <ul
                  class="search-result-list"
                  :class="{
                    'has-overflow-above': hasHiddenResultsAbove,
                    'has-overflow-below': hasHiddenResultsBelow,
                  }"
                  @scroll="updateResultFades"
                >
                  <li v-for="item in results" :key="resultKey(item)">
                    <ComboboxItem
                      as="button"
                      type="button"
                      :value="item"
                      :text-value="resultTextValue(item)"
                      @select="choose(item)"
                    >
                      <b>{{ item.booth.hall }} · {{ resultCode(item) }}</b>
                      <span>{{ resultSummary(item) }}</span>
                      <AppIcon class="result-arrow" name="chevron" />
                    </ComboboxItem>
                  </li>
                </ul>
              </ComboboxViewport>
            </template>
          </ComboboxContent>
        </ComboboxRoot>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.map-search {
  position: relative;
  flex: 1;
  min-width: 0;
  max-width: 440px;
}

.map-search > button {
  position: absolute;
}

.search-panel {
  position: absolute;
  inset: 0 0 auto;
  transform-origin: 24px 24px;
}

.search-combobox {
  min-width: 0;
}

.search-filter-position {
  position: absolute;
  top: 0;
  right: 0;
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
  margin-right: calc(var(--control-size) + 8px);
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

.search-form .ui-text-button {
  flex-shrink: 0;
  min-height: 44px;
}

.search-results {
  margin-top: 10px;
  max-height: min(50dvh, 420px);
  overflow-y: auto;
  padding: 16px;
}

.search-result-list {
  --search-result-mask: none;

  margin: 8px 0 0;
  padding: 0;
  list-style: none;

  /* Chromium 111 需要前缀才能渲染遮罩渐变。 */
  /* stylelint-disable-next-line property-no-vendor-prefix */
  -webkit-mask-image: var(--search-result-mask);
  mask-image: var(--search-result-mask);
}

.search-result-list.has-overflow-below {
  --search-result-mask: linear-gradient(
    to bottom,
    #000 0,
    #000 calc(100% - 24px),
    transparent 100%
  );
}

.search-result-list.has-overflow-above:not(.has-overflow-below) {
  --search-result-mask: linear-gradient(to bottom, transparent 0, #000 24px, #000 100%);
}

.search-result-list.has-overflow-above.has-overflow-below {
  --search-result-mask: linear-gradient(
    to bottom,
    transparent 0,
    #000 24px,
    #000 calc(100% - 24px),
    transparent 100%
  );
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
  top: 50%;
  width: 18px;
  height: 18px;
  translate: 0 -50%;
  rotate: 90deg;
}
</style>
