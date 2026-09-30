<script setup lang="ts">
import { ref, watch } from "vue";

import AppIcon from "./ui/AppIcon.vue";

const props = defineProps<{ active: boolean; disabled: boolean }>();
const emit = defineEmits<{ toggle: [] }>();

const animating = ref(false);
let pendingFavorite = false;

function toggle() {
  pendingFavorite = !props.active;
  emit("toggle");
}

watch(
  () => {
    return [props.active, props.disabled] as const;
  },
  ([active, disabled], [wasActive]) => {
    if (active !== wasActive) {
      animating.value = active && pendingFavorite;
      pendingFavorite = false;
    }

    if (!disabled) {
      pendingFavorite = false;
    }
  },
);
</script>

<template>
  <button
    class="favorite-button"
    :class="{ 'is-animating': animating }"
    :aria-label="active ? '取消收藏' : '收藏展位'"
    :aria-pressed="active"
    :disabled="disabled"
    @pointerdown.stop
    @touchstart.stop
    @click="toggle"
  >
    <AppIcon name="star" :filled="active" @animationend="animating = false" />
  </button>
</template>

<style scoped>
.favorite-button {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  height: 44px;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-handle);
}

.favorite-button svg {
  height: 24px;
}

.favorite-button[aria-pressed="true"] svg {
  color: #ffd34e;
}

.favorite-button.is-animating svg {
  animation: favorite-pop 360ms ease-out;
}

.favorite-button:disabled {
  opacity: 0.5;
}

@keyframes favorite-pop {
  0% {
    scale: 0.7;
    rotate: -18deg;
  }

  55% {
    scale: 1.25;
    rotate: 8deg;
  }

  100% {
    scale: 1;
    rotate: 0deg;
  }
}
</style>
