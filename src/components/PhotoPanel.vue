<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

import { booths, type Booth } from "../data/exhibition";
import { nativePhotos, photos, type Photo } from "../services/photos";
import PhotoReassignDialog from "./PhotoReassignDialog.vue";
import PhotoTile from "./PhotoTile.vue";
import PhotoViewer from "./PhotoViewer.vue";
import AppIcon from "./ui/AppIcon.vue";
import LoadingIcon from "./ui/LoadingIcon.vue";

const props = withDefaults(
  defineProps<{
    booth: Booth;
    active: boolean;
    expanded: boolean;
    insertPosition?: "start" | "end";
  }>(),
  { insertPosition: "end" },
);

const items = ref<(Photo & { thumbnail?: string; unavailable?: boolean })[]>([]);
const busy = ref(false);
const loading = ref(false);
const message = ref("");
const content = ref<HTMLElement>();
const height = ref<number>();
const reassignDialog = ref<InstanceType<typeof PhotoReassignDialog>>();
const fileInput = ref<HTMLInputElement>();
const viewerUri = ref("");
let request = 0;
let generation = 0;
let observer: ResizeObserver | undefined;
let pickerPointer: { id: number; x: number; y: number } | undefined;

async function refresh() {
  if (!props.active) {
    return;
  }

  const token = ++request;
  loading.value = true;
  try {
    const result = await photos.list({ boothId: props.booth.id });
    if (request !== token) {
      return;
    }

    const previous = new Map(
      items.value.map((item) => {
        return [item.uri, item];
      }),
    );
    items.value = result.photos.map((item) => {
      return previous.get(item.uri) ?? item;
    });
    for (const item of items.value) {
      if (request !== token) {
        return;
      }
      if (item.thumbnail) {
        continue;
      }

      try {
        const preview = await photos.thumbnail({ uri: item.uri });
        if (request === token) {
          item.thumbnail = preview.dataUrl;
          item.unavailable = false;
        }
      } catch {
        if (request === token) {
          item.unavailable = true;
        }
      }
    }
  } catch {
    if (request === token) {
      message.value = "暂时无法读取贴图记录，请重试。";
    }
  } finally {
    if (request === token) {
      loading.value = false;
    }
  }
}

async function mutate(action: (current: () => boolean) => Promise<void>, failure: string) {
  if (busy.value || !props.active) {
    return;
  }

  const token = generation;

  const current = () => {
    return token === generation && props.active;
  };

  busy.value = true;
  message.value = "";
  try {
    await action(current);
  } catch (error) {
    if (current()) {
      message.value =
        error instanceof DOMException && error.name === "QuotaExceededError"
          ? "浏览器存储空间不足，贴图未保存。请释放设备空间后重试。"
          : failure;
    }
  } finally {
    if (current()) {
      await refresh();
      if (current()) {
        busy.value = false;
      }
    }
  }
}

async function associate(picked?: Promise<{ uris: string[]; failed: number }>) {
  const booth = props.booth;
  await mutate(async (current) => {
    let uris: string[] = [];
    try {
      const result = await (picked ?? photos.pick());
      uris = result.uris;
      for (const uri of uris) {
        if (!current()) {
          break;
        }

        const response = await photos.assign({ uri, boothId: booth.id, replace: false });
        if (!current()) {
          break;
        }
        if (response.conflict) {
          const old = booths.find((entry) => {
            return entry.id === response.conflict;
          });
          const confirmed = await reassignDialog.value?.confirm({
            previousBooth: old ? `${old.hall} ${old.code}` : response.conflict,
            nextBooth: `${booth.hall} ${booth.code}`,
          });
          if (confirmed && current()) {
            await photos.assign({ uri, boothId: booth.id, replace: true });
          }
        }
      }
      if (current()) {
        message.value = result.failed ? `${result.failed} 张图片无法读取，请重新选择。` : "";
      }
    } finally {
      try {
        await photos.releaseUnlinked({ uris });
      } catch {
        if (current()) {
          message.value = "未关联图片的授权释放失败。";
        }
      }
    }
  }, "关联未完成，请重试。已保存的记录会保留。");
}

function selectPhoto(event: MouseEvent) {
  // 指针操作已在 pointerup 中打开选择器；这里只处理键盘等非指针激活。
  if (event.detail !== 0) {
    return;
  }

  if (nativePhotos) {
    void associate();
  } else {
    fileInput.value?.click();
  }
}

function startPickerPointer(event: PointerEvent) {
  if (busy.value || !event.isPrimary || event.button !== 0) {
    pickerPointer = undefined;

    return;
  }

  pickerPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
}

function finishPickerPointer(event: PointerEvent) {
  const pointer = pickerPointer;
  pickerPointer = undefined;
  if (
    busy.value ||
    !pointer ||
    event.pointerId !== pointer.id ||
    Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 12
  ) {
    return;
  }

  // 展开动画仍在改变布局时，移动端 Chromium 可能抑制随后合成的 click。
  event.preventDefault();
  if (nativePhotos) {
    void associate();
  } else {
    fileInput.value?.click();
  }
}

function cancelPickerPointer() {
  pickerPointer = undefined;
}

function selectWebFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  if (files.length) {
    void associate(photos.stageFiles(files));
  }

  input.value = "";
}

async function remove(uri: string) {
  await mutate(() => {
    return photos.remove({ uri });
  }, "解除关联失败，请重试。");
}

async function open(uri: string) {
  if (!props.active) {
    return;
  }

  const token = generation;
  try {
    if (nativePhotos) {
      await photos.open({ uri });
    } else {
      viewerUri.value = uri;
    }
  } catch {
    if (generation === token && props.active) {
      message.value = "原图不可访问，请重试。";
    }
  }
}

function closeViewer() {
  viewerUri.value = "";
}

function pinLeavingPhoto(element: Element) {
  const tile = element as HTMLElement;
  // 脱离网格前保留位置和尺寸，让其余卡片在淡出期间开始补位。
  Object.assign(tile.style, {
    left: `${tile.offsetLeft}px`,
    top: `${tile.offsetTop}px`,
    width: `${tile.offsetWidth}px`,
    height: `${tile.offsetHeight}px`,
  });
  tile.inert = true;
}

const orderedItems = computed(() => {
  const ordered = [...items.value];
  ordered.sort((left, right) => {
    return props.insertPosition === "start"
      ? right.createdAt - left.createdAt
      : left.createdAt - right.createdAt;
  });

  return ordered;
});

watch(
  () => {
    return props.expanded;
  },
  async () => {
    // 隐藏期间 ResizeObserver 不测量内容；开合前恢复自然高度供 Collapsible 测量。
    height.value = undefined;
    await nextTick();
    height.value = content.value?.getBoundingClientRect().height || undefined;
  },
);

watch(
  () => {
    return props.active;
  },
  (active) => {
    generation += 1;
    request += 1;
    busy.value = false;
    loading.value = false;
    pickerPointer = undefined;
    if (active) {
      void refresh();
    } else {
      reassignDialog.value?.cancel();
      closeViewer();
    }
  },
  { immediate: true },
);

onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (entry && content.value) {
      const size = content.value.getBoundingClientRect().height;
      if (size > 0) {
        height.value = size;
      }
    }
  });
  if (content.value) {
    observer.observe(content.value);
  }
});

onUnmounted(() => {
  generation += 1;
  request += 1;
  pickerPointer = undefined;
  observer?.disconnect();
  closeViewer();
});
</script>

<template>
  <div class="photos-resize" :style="{ height: height === undefined ? undefined : `${height}px` }">
    <section ref="content" class="photos" aria-label="展位贴图" :aria-busy="loading || busy">
      <h3>
        展位贴图 <span>{{ items.length }}</span>
      </h3>
      <p class="ui-muted">
        {{
          nativePhotos
            ? "添加现场照片、商品信息图等，长按图片可解除关联。"
            : "贴图仅保存在当前浏览器中，长按图片可解除关联。"
        }}
      </p>
      <p v-if="message" role="status" class="notice">{{ message }}</p>
      <TransitionGroup
        name="photo-list"
        tag="div"
        class="photo-grid"
        @before-leave="pinLeavingPhoto"
      >
        <div v-for="item in orderedItems" :key="item.uri" class="photo-item">
          <PhotoTile
            :thumbnail="item.thumbnail"
            :unavailable="item.unavailable"
            :busy="busy"
            @open="open(item.uri)"
            @remove="remove(item.uri)"
          />
        </div>
        <button
          key="add-photo"
          class="add-photo"
          aria-label="添加贴图"
          :disabled="busy || loading"
          @click="selectPhoto"
          @pointerdown="startPickerPointer"
          @pointerup="finishPickerPointer"
          @pointercancel="cancelPickerPointer"
        >
          <AppIcon v-show="!busy && !loading" name="plus" />
          <LoadingIcon :active="busy || loading" />
        </button>
      </TransitionGroup>
      <input
        v-if="!nativePhotos"
        ref="fileInput"
        class="file-input"
        type="file"
        accept="image/*"
        multiple
        tabindex="-1"
        aria-hidden="true"
        @change="selectWebFiles"
      />
      <PhotoReassignDialog ref="reassignDialog" />
      <PhotoViewer
        v-if="!nativePhotos && viewerUri"
        :items="orderedItems"
        :initial-uri="viewerUri"
        @close="closeViewer"
      />
    </section>
  </div>
</template>

<style scoped>
.photos-resize {
  overflow: hidden;
  transition: height var(--duration-normal);
}

.photos {
  border-top: 1px solid var(--color-border);
  padding-top: 12px;
  container-type: inline-size;
}

.file-input {
  display: none;
}

h3 {
  font-size: 13px;
}

h3 span {
  font-weight: 400;
  color: var(--color-muted);
}

.ui-muted,
.notice {
  margin: 8px 0;
}

.notice {
  color: var(--color-primary-ink);
  font-size: 12px;
  line-height: 1.6;
}

.photo-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

@container (width >= 440px) {
  .photo-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.photo-item {
  min-width: 0;
}

.photo-list-move {
  transition: transform var(--duration-normal);
}

.photo-list-enter-active,
.photo-list-leave-active {
  transition:
    opacity var(--duration-normal),
    scale var(--duration-normal);
}

.photo-list-enter-from,
.photo-list-leave-to {
  opacity: 0;
  scale: 0.94;
}

.photo-list-leave-active {
  position: absolute;
  z-index: 1;
  pointer-events: none;
}

.add-photo {
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 1;
  border: 1px dashed var(--color-handle);
  border-radius: var(--radius-small);
  background: var(--color-accent-soft);
  color: var(--color-primary-ink);
}

.add-photo > * {
  grid-area: 1 / 1;
}
</style>
