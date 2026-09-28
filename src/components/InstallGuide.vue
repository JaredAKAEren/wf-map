<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef } from "vue";

import { nativePhotos } from "../services/photos";

interface InstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: "accepted" | "dismissed" }>;
}

const shown = ref(false);
const installed = ref(false);
const offlineReady = ref(false);
const promptEvent = shallowRef<InstallPromptEvent>();
const isIos =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const displayMode = window.matchMedia("(display-mode: standalone)");
const tipKey = "wf-map/install-tip-v1";
const pagesBuild = import.meta.env.VITE_WF_PAGES === "1";

function checkInstalled() {
  installed.value =
    displayMode.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  if (installed.value) {
    shown.value = false;
  }
}

function markInstalled() {
  installed.value = true;
  shown.value = false;
}

function capturePrompt(event: Event) {
  event.preventDefault();
  promptEvent.value = event as InstallPromptEvent;
}

function hide() {
  shown.value = false;
  try {
    localStorage.setItem(tipKey, "dismissed");
  } catch {
    // 隐私模式可能禁用本地存储；仍可关闭当前提示。
  }
}

async function install() {
  const pending = promptEvent.value;
  if (!pending) {
    return;
  }

  promptEvent.value = undefined;
  try {
    const result = await pending.prompt();
    if (result.outcome === "accepted") {
      hide();
    }
  } catch {
    // 提示可能已失效，保留手动安装说明。
  }
}

onMounted(() => {
  if (nativePhotos || !pagesBuild) {
    return;
  }

  checkInstalled();
  try {
    shown.value = !installed.value && localStorage.getItem(tipKey) !== "dismissed";
  } catch {
    shown.value = !installed.value;
  }
  window.addEventListener("beforeinstallprompt", capturePrompt);
  window.addEventListener("appinstalled", markInstalled);
  displayMode.addEventListener("change", checkInstalled);
  void navigator.serviceWorker?.ready.then(() => {
    offlineReady.value = true;
  });
});

onUnmounted(() => {
  window.removeEventListener("beforeinstallprompt", capturePrompt);
  window.removeEventListener("appinstalled", markInstalled);
  displayMode.removeEventListener("change", checkInstalled);
});
</script>

<template>
  <div v-if="!nativePhotos && !installed && pagesBuild" class="install-guide">
    <button class="install-trigger ui-surface" aria-label="添加到桌面" @click="shown = !shown">
      安装
    </button>
    <section v-if="shown" class="install-popover ui-surface" aria-label="添加到桌面说明">
      <button class="install-close" aria-label="关闭安装提示" @click="hide">×</button>
      <strong>添加到桌面，离线逛展</strong>
      <p v-if="isIos">点浏览器的“分享”，选择“添加到主屏幕”，然后从桌面打开。</p>
      <p v-else-if="promptEvent">安装后可从桌面打开，已准备的地图可离线查看。</p>
      <p v-else>在浏览器菜单中选择“安装应用”或“添加到桌面”。</p>
      <p class="storage-tip">请先安装，再在桌面应用内添加贴图。贴图仅保存在当前浏览器或应用中。</p>
      <p class="storage-tip">{{ offlineReady ? "离线地图已准备好" : "正在准备离线地图" }}</p>
      <button v-if="promptEvent" class="install-action" @click="install">安装应用</button>
    </section>
  </div>
</template>

<style scoped>
.install-guide {
  position: relative;
  margin-left: auto;
}

.install-trigger {
  min-width: 48px;
  min-height: var(--control-size);
  padding: 0 12px;
  border-radius: var(--radius-pill);
  color: var(--color-primary-ink);
  font-size: 13px;
  font-weight: 650;
}

.install-popover {
  position: absolute;
  right: 0;
  top: calc(100% + 10px);
  width: min(300px, calc(100vw - 24px));
  padding: 18px;
  border-radius: var(--radius-floating);
  box-shadow: var(--shadow-floating);
  font-size: 13px;
  line-height: 1.6;
}

.install-popover strong {
  display: block;
  padding-right: 24px;
  color: var(--color-primary-ink);
  font-size: 14px;
}

.install-popover p {
  margin-top: 8px;
}

.storage-tip {
  color: var(--color-muted);
}

.install-close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 32px;
  height: 32px;
  background: transparent;
  font-size: 23px;
}

.install-action {
  margin-top: 12px;
  min-height: 40px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-weight: 650;
}
</style>
