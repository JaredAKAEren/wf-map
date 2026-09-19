<script setup lang="ts">
import { ToggleGroupItem, ToggleGroupRoot } from "reka-ui";

defineProps<{ modelValue: string; halls: string[] }>();
const emit = defineEmits<{ select: [hall: string] }>();
</script>

<template>
  <ToggleGroupRoot
    class="hall-switcher ui-surface"
    type="single"
    :model-value="modelValue"
    aria-label="展馆选择"
  >
    <ToggleGroupItem
      v-for="name in halls"
      :key="name"
      :value="name"
      @click="emit('select', name)"
      >{{ name }}</ToggleGroupItem
    >
  </ToggleGroupRoot>
</template>

<style scoped>
.hall-switcher {
  display: flex;
  padding: 5px;
  gap: 2px;
  border-radius: var(--radius-pill);
}

.hall-switcher button {
  flex: 1;
  min-height: 42px;
  border-radius: var(--radius-pill);
  background: transparent;
  font-weight: 650;
  font-size: 13px;
}

.hall-switcher button[data-state="on"] {
  color: var(--color-on-primary);
  background: var(--color-primary);
}
</style>
