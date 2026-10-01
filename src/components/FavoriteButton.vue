<script setup lang="ts">
import { ref, useId, watch } from "vue";

import AppIcon from "./ui/AppIcon.vue";

const props = defineProps<{ active: boolean; disabled: boolean }>();
const emit = defineEmits<{ toggle: [] }>();

const waveMaskId = useId();
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
    <svg
      v-if="animating"
      class="favorite-wave"
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <mask :id="waveMaskId" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
          <rect width="32" height="32" fill="white" />
          <circle class="favorite-wave-hole" cx="16" cy="16" r="0" fill="black" />
        </mask>
      </defs>
      <circle
        class="favorite-wave-disc"
        cx="16"
        cy="16"
        r="0"
        :mask="`url(#${waveMaskId})`"
        @animationend="animating = false"
      />
    </svg>
    <AppIcon class="favorite-star" name="star" :filled="active" />
  </button>
</template>

<style scoped>
.favorite-button {
  --favorite-duration: 480ms;

  position: relative;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  height: 44px;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-handle);
}

.favorite-star {
  position: relative;
  height: 24px;
}

.favorite-button[aria-pressed="true"] .favorite-star {
  color: #ffd34e;
}

.favorite-button.is-animating .favorite-star {
  animation: favorite-pop var(--favorite-duration) ease-out;
}

.favorite-wave {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 32px;
  height: 32px;
  translate: -50% -50%;
  pointer-events: none;
}

.favorite-wave-disc {
  animation: favorite-wave var(--favorite-duration) linear;
}

.favorite-wave-hole {
  animation: favorite-wave-hole var(--favorite-duration) ease-out;
}

.favorite-button:disabled {
  opacity: 0.5;
}

@keyframes favorite-pop {
  0%,
  25% {
    opacity: 0;
    scale: 0;
  }

  28% {
    opacity: 1;
    scale: 0;
  }

  58% {
    opacity: 1;
    scale: 1.15;
  }

  78% {
    scale: 0.98;
  }

  100% {
    opacity: 1;
    scale: 1;
  }
}

@keyframes favorite-wave {
  0% {
    r: 0;
    fill: #ffd34e;
    opacity: 1;
  }

  22% {
    r: 12px;
    fill: #ffd34e;
  }

  30% {
    r: 15px;
    fill: #ffe5a0;
  }

  72% {
    r: 15px;
    fill: #ffe5a0;
    opacity: 1;
  }

  100% {
    r: 16px;
    fill: #ffe5a0;
    opacity: 0;
  }
}

@keyframes favorite-wave-hole {
  0%,
  22% {
    r: 0;
  }

  28% {
    r: 3px;
  }

  58% {
    r: 13px;
  }

  78% {
    r: 14.5px;
  }

  100% {
    r: 16px;
  }
}
</style>
