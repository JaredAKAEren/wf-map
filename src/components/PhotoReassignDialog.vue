<script setup lang="ts">
import {
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from "reka-ui";
import { onUnmounted, ref } from "vue";

interface ConfirmationDetails {
  previousBooth: string;
  nextBooth: string;
}

const opened = ref(false);
const details = ref<ConfirmationDetails>();
let resolveConfirmation: ((confirmed: boolean) => void) | undefined;

function confirm(nextDetails: ConfirmationDetails) {
  resolveConfirmation?.(false);
  details.value = nextDetails;
  opened.value = true;

  return new Promise<boolean>((resolve) => {
    resolveConfirmation = resolve;
  });
}

function finish(confirmed: boolean) {
  const resolve = resolveConfirmation;
  resolveConfirmation = undefined;
  opened.value = false;
  resolve?.(confirmed);
}

function handleOpenChange(value: boolean) {
  opened.value = value;
  if (!value) {
    finish(false);
  }
}

onUnmounted(() => {
  resolveConfirmation?.(false);
  resolveConfirmation = undefined;
});

defineExpose({
  confirm,
  cancel: () => {
    finish(false);
  },
});
</script>

<template>
  <AlertDialogRoot :open="opened" @update:open="handleOpenChange">
    <AlertDialogPortal>
      <AlertDialogOverlay class="dialog-overlay" />
      <AlertDialogContent class="dialog-content ui-surface">
        <AlertDialogTitle class="dialog-title">更改贴图关联？</AlertDialogTitle>
        <AlertDialogDescription class="dialog-description">
          这张图片已关联 {{ details?.previousBooth }}。确认改为 {{ details?.nextBooth }}？
        </AlertDialogDescription>
        <div class="dialog-actions">
          <AlertDialogCancel class="dialog-button dialog-cancel" @click="finish(false)">
            取消
          </AlertDialogCancel>
          <button class="dialog-button dialog-confirm" type="button" @click="finish(true)">
            确认更改
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: rgb(48 39 29 / 24%);
}

.dialog-content {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 21;
  width: min(360px, calc(100% - 32px));
  padding: 22px;
  transform: translate(-50%, -50%);
}

.dialog-title {
  margin: 0;
  font-size: 18px;
}

.dialog-description {
  margin: 10px 0 0;
  color: var(--color-muted);
  font-size: 13px;
  line-height: 1.7;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.dialog-button {
  min-height: 42px;
  padding: 8px 16px;
  border-radius: var(--radius-pill);
  font-size: 13px;
  font-weight: 650;
}

.dialog-cancel {
  background: var(--color-accent-soft);
  color: var(--color-primary-ink);
}

.dialog-confirm {
  background: var(--color-primary);
  color: var(--color-on-primary);
}
</style>
