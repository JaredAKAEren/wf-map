<script setup lang="ts">
defineProps<{ name: "search" | "plus" | "close" | "chevron" | "loader" }>();
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <template v-if="name === 'search'">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </template>
    <path v-else-if="name === 'plus'" d="M5 12h14M12 5v14" />
    <path v-else-if="name === 'chevron'" d="m6 15 6-6 6 6" />
    <path v-else-if="name === 'loader'" d="M12 3a9 9 0 1 1-9 9" />
    <path v-else d="m6 6 12 12M6 18 18 6" />
  </svg>
</template>

<style scoped>
svg {
  display: block;
  flex-shrink: 0;
}
</style>
