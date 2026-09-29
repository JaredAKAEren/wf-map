<script setup lang="ts">
import { ToastClose, ToastProvider, ToastRoot, ToastTitle, ToastViewport } from "reka-ui";
import { computed, onMounted, onUnmounted, ref, shallowRef } from "vue";

import { activatePwaUpdate, pwaUpdateReadyEvent } from "../services/pwa";

const props = defineProps<{
  notice: string;
}>();
const emit = defineEmits<{
  "update:notice": [value: string];
}>();

const updateOpen = ref(false);
const updating = ref(false);
const registration = shallowRef<ServiceWorkerRegistration>();
const noticeOpen = computed({
  get: () => {
    return Boolean(props.notice);
  },
  set: (open) => {
    if (!open) {
      emit("update:notice", "");
    }
  },
});

function receiveUpdate(event: Event) {
  registration.value = (event as CustomEvent<ServiceWorkerRegistration>).detail;
  updateOpen.value = true;
}

function refresh() {
  if (!registration.value || updating.value) {
    return;
  }

  updating.value = activatePwaUpdate(registration.value);
}

onMounted(() => {
  window.addEventListener(pwaUpdateReadyEvent, receiveUpdate);
});

onUnmounted(() => {
  window.removeEventListener(pwaUpdateReadyEvent, receiveUpdate);
});
</script>

<template>
  <ToastProvider label="应用通知" :duration="0" disable-swipe>
    <ToastRoot v-model:open="noticeOpen" class="app-toast ui-surface">
      <ToastTitle class="app-toast-title">{{ notice }}</ToastTitle>
      <ToastClose as-child>
        <button class="app-toast-action" type="button" aria-label="关闭提示">关闭</button>
      </ToastClose>
    </ToastRoot>
    <ToastRoot
      v-model:open="updateOpen"
      class="app-toast pwa-update-toast ui-surface"
      @escape-key-down="$event.preventDefault()"
    >
      <ToastTitle class="app-toast-title">新版本已准备好</ToastTitle>
      <button class="app-toast-action" type="button" :disabled="updating" @click="refresh">
        {{ updating ? "正在刷新" : "刷新" }}
      </button>
    </ToastRoot>
    <ToastViewport class="app-toast-viewport" label="应用通知" />
  </ToastProvider>
</template>

<style scoped>
/* Reka Toast 会 Teleport 到 body，使用唯一全局类命中传送后的节点。 */
/* stylelint-disable selector-pseudo-class-no-unknown -- Vue scoped CSS 的 :global() 用于传送节点。 */
:global(.app-toast-viewport) {
  position: fixed;
  top: calc(var(--screen-padding) + env(safe-area-inset-top) + var(--control-size) + 8px);
  right: var(--screen-padding);
  z-index: 7;
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  gap: 8px;
  width: max-content;
  max-width: calc(100% - 24px);
  margin: 0;
  padding: 0;
  list-style: none;
  outline: none;
  pointer-events: none;
}

:global(.app-toast.ui-surface) {
  display: flex;
  align-items: center;
  gap: 8px;
  width: max-content;
  max-width: min(100%, 360px);
  min-height: 48px;
  padding: 6px 7px 6px 14px;
  border-radius: var(--radius-small);
  background: rgb(255 253 249 / 96%);
  box-shadow:
    0 4px 12px rgb(49 34 18 / 20%),
    0 14px 36px rgb(49 34 18 / 24%);
  pointer-events: auto;
}

:global(.app-toast[data-state="open"]) {
  animation: app-toast-in var(--duration-normal);
}

:global(.app-toast[data-state="closed"]) {
  animation: app-toast-out var(--duration-fast);
}

:global(.app-toast-title) {
  min-width: 0;
  font-size: 14px;
  font-weight: 650;
  line-height: 1.35;
}

:global(.app-toast-action) {
  align-self: stretch;
  flex-shrink: 0;
  min-height: 36px;
  padding: 0 12px;
  border-radius: 10px;
  background: var(--color-accent-soft);
  color: var(--color-primary-ink);
  font-size: 13px;
  font-weight: 650;
}
/* stylelint-enable selector-pseudo-class-no-unknown */

@keyframes app-toast-in {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.96);
  }
}

@keyframes app-toast-out {
  to {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
}
</style>
