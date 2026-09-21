<script setup lang="ts">
import { ref, watch } from "vue";

import AppIcon from "./AppIcon.vue";

const props = defineProps<{ active: boolean }>();

const visible = ref(false);

watch(
  () => {
    return props.active;
  },
  (active, _, onCleanup) => {
    if (!active) {
      visible.value = false;
      return;
    }

    const timer = setTimeout(() => {
      visible.value = true;
    }, 200);
    onCleanup(() => {
      clearTimeout(timer);
    });
  },
  { immediate: true },
);
</script>

<template>
  <Transition name="loading" appear>
    <span v-if="visible" class="loading-icon" role="status" aria-label="正在加载">
      <AppIcon name="loader" />
    </span>
  </Transition>
</template>

<style scoped>
.loading-icon {
  display: inline-flex;
  color: var(--color-primary-ink);
}

.loading-icon svg {
  animation: spin 900ms linear infinite;
}

.loading-enter-active,
.loading-leave-active {
  transition: opacity var(--duration-fast);
}

.loading-enter-from,
.loading-leave-to {
  opacity: 0;
}

@keyframes spin {
  to {
    rotate: 360deg;
  }
}
</style>
