<script setup lang="ts">
defineProps<{
  name: "search" | "plus" | "close" | "chevron" | "loader" | "star" | "image" | "filter" | "check";
  filled?: boolean;
  strokeWidth?: number;
}>();

const starOuter =
  "M11.05 4.07 A1.05 1.05 0 0 1 12.95 4.07 L14.85 8.18 A0.65 0.65 0 0 0 15.35 8.55 L19.92 9.2 A1.05 1.05 0 0 1 20.52 10.98 L17.24 14.26 A0.65 0.65 0 0 0 17.06 14.83 L17.83 19.32 A1.05 1.05 0 0 1 16.28 20.41 L12.32 18.18 A0.65 0.65 0 0 0 11.68 18.18 L7.72 20.41 A1.05 1.05 0 0 1 6.17 19.32 L6.94 14.83 A0.65 0.65 0 0 0 6.76 14.26 L3.48 10.98 A1.05 1.05 0 0 1 4.08 9.2 L8.65 8.55 A0.65 0.65 0 0 0 9.15 8.18 Z";
// 实心状态缩小尖角圆弧，并保持与空心状态相同的外接尺寸。
const starFilled =
  "M11.387 3.864 A0.67 0.668 0 0 1 12.613 3.864 L14.729 8.443 A0.622 0.62 0 0 0 15.208 8.796 L20.245 9.511 A0.67 0.668 0 0 1 20.628 10.646 L17.018 14.242 A0.622 0.62 0 0 0 16.845 14.786 L17.697 19.764 A0.67 0.668 0 0 1 16.711 20.461 L12.306 17.981 A0.622 0.62 0 0 0 11.694 17.981 L7.289 20.461 A0.67 0.668 0 0 1 6.303 19.764 L7.155 14.786 A0.622 0.62 0 0 0 6.982 14.242 L3.372 10.646 A0.67 0.668 0 0 1 3.755 9.511 L8.792 8.796 A0.622 0.62 0 0 0 9.271 8.443 Z";
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth ?? 2"
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
    <path
      v-else-if="name === 'star'"
      :d="filled ? starFilled : starOuter"
      :fill="filled ? 'currentColor' : 'none'"
      :stroke-width="strokeWidth ?? 1.6"
    />
    <template v-else-if="name === 'image'">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8" cy="8" r="1" />
      <path d="m3 17 5-5 4 4 4-6 5 7" />
    </template>
    <path v-else-if="name === 'filter'" d="M4 7h16M7 12h10M10 17h4" />
    <path
      v-else-if="name === 'check'"
      d="M5 12 7.6 14.6 Q9 16 10.4 14.6 L19 6"
      stroke-width="4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path v-else d="m6 6 12 12M6 18 18 6" />
  </svg>
</template>

<style scoped>
svg {
  display: block;
  flex-shrink: 0;
}
</style>
