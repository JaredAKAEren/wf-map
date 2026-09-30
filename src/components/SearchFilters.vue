<script setup lang="ts">
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from "reka-ui";
import { computed } from "vue";

import type { BoothFilters } from "../domain/booth-filter";
import AppIcon from "./ui/AppIcon.vue";

const filters = defineModel<BoothFilters>({ required: true });
defineProps<{ photosReady: boolean; favoritesReady: boolean }>();

const count = computed(() => {
  return Number(filters.value.photos) + Number(filters.value.favorites);
});

function update(key: keyof BoothFilters, checked: boolean | "indeterminate") {
  filters.value = { ...filters.value, [key]: checked === true };
}
</script>

<template>
  <div>
    <DropdownMenuRoot :modal="false">
      <DropdownMenuTrigger
        class="filter-trigger ui-surface ui-icon-button"
        :aria-label="count ? `筛选展位，已选 ${count} 项` : '筛选展位'"
      >
        <AppIcon name="filter" />
        <span v-if="count" class="filter-count">{{ count }}</span>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent as-child align="end" :side-offset="10">
          <div class="filter-menu ui-surface">
            <DropdownMenuCheckboxItem
              class="filter-option"
              :model-value="filters.photos"
              :disabled="!photosReady"
              @update:model-value="update('photos', $event)"
              @select.prevent
            >
              <AppIcon class="filter-option-icon filter-photo-icon" name="image" />
              已贴图
              <span class="filter-check"><AppIcon v-if="filters.photos" name="check" /></span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              class="filter-option"
              :model-value="filters.favorites"
              :disabled="!favoritesReady"
              @update:model-value="update('favorites', $event)"
              @select.prevent
            >
              <AppIcon class="filter-option-icon" name="star" :stroke-width="1.9" />
              已收藏
              <span class="filter-check"><AppIcon v-if="filters.favorites" name="check" /></span>
            </DropdownMenuCheckboxItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </div>
</template>

<style scoped>
.filter-trigger {
  position: relative;
}

.filter-count {
  position: absolute;
  top: -2px;
  right: -2px;
  display: grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: 11px;
  font-weight: 700;
}

.filter-menu {
  z-index: 10;
  width: max-content;
  padding: 6px;
  border-radius: 14px;
  transform-origin: var(--reka-dropdown-menu-content-transform-origin);
}

.filter-menu[data-state="open"] {
  animation: filter-in var(--duration-fast) ease-out;
}

.filter-menu[data-state="closed"] {
  pointer-events: none;
  animation: filter-out var(--duration-fast) ease-in;
}

@keyframes filter-in {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.94);
  }
}

@keyframes filter-out {
  to {
    opacity: 0;
    transform: translateY(-4px) scale(0.94);
  }
}

.filter-option {
  display: grid;
  grid-template-columns: 18px auto 14px;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 6px;
  border-radius: 8px;
  font-size: 14px;
  white-space: nowrap;
  cursor: pointer;
}

.filter-option-icon {
  width: 18px;
  height: 18px;
}

.filter-photo-icon {
  width: 17px;
  height: 17px;
}

.filter-option[data-disabled] {
  opacity: 0.5;
  cursor: default;
}

.filter-check {
  display: grid;
  place-items: center;
  width: 14px;
  height: 18px;
  color: var(--color-primary);
}

.filter-check svg {
  width: 14px;
  height: 14px;
}
</style>
