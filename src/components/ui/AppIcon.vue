<script setup lang="ts">
defineProps<{
  name: "search" | "plus" | "close" | "chevron" | "loader" | "star" | "image" | "filter" | "check";
  filled?: boolean;
  strokeWidth?: number;
}>();

// 五个外角以 (12, 12) 为中心等距分布，圆角后仍保持旋转对称。
const starOuter =
  "M11.044 3.599 A1.05 1.05 0 0 1 12.956 3.599 L14.786 7.62 A0.65 0.65 0 0 0 15.305 7.996 L19.695 8.495 A1.05 1.05 0 0 1 20.285 10.313 L17.027 13.297 A0.65 0.65 0 0 0 16.829 13.906 L17.711 18.235 A1.05 1.05 0 0 1 16.165 19.358 L12.32 17.181 A0.65 0.65 0 0 0 11.68 17.181 L7.835 19.358 A1.05 1.05 0 0 1 6.289 18.235 L7.171 13.906 A0.65 0.65 0 0 0 6.973 13.297 L3.715 10.313 A1.05 1.05 0 0 1 4.305 8.495 L8.695 7.996 A0.65 0.65 0 0 0 9.214 7.62 Z";
// 实心状态缩小尖角圆弧，并保持与空心状态相同的外角半径。
const starFilled =
  "M11.396 3.373 A0.664 0.664 0 0 1 12.604 3.373 L14.641 7.848 A0.616 0.616 0 0 0 15.133 8.205 L20.019 8.76 A0.664 0.664 0 0 1 20.392 9.908 L16.765 13.229 A0.616 0.616 0 0 0 16.578 13.807 L17.56 18.625 A0.664 0.664 0 0 1 16.582 19.335 L12.304 16.912 A0.616 0.616 0 0 0 11.696 16.912 L7.418 19.335 A0.664 0.664 0 0 1 6.44 18.625 L7.422 13.807 A0.616 0.616 0 0 0 7.235 13.229 L3.608 9.908 A0.664 0.664 0 0 1 3.981 8.76 L8.867 8.205 A0.616 0.616 0 0 0 9.359 7.848 Z";
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
