<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

import { booths, type Booth } from "../data/exhibition";
import { nativePhotos, photos, type Photo } from "../services/photos";
import PhotoReassignDialog from "./PhotoReassignDialog.vue";
import PhotoTile from "./PhotoTile.vue";
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
let request = 0;
let generation = 0;
let observer: ResizeObserver | undefined;

async function refresh() {
  if (!nativePhotos || !props.active) {
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
  } catch {
    if (current()) {
      message.value = failure;
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

async function associate() {
  const booth = props.booth;
  await mutate(async (current) => {
    let uris: string[] = [];
    try {
      const result = await photos.pick();
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
        message.value = result.failed
          ? `${result.failed} 张图片未能取得长期读取权限，请重新选择。`
          : "";
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

async function remove(uri: string) {
  await mutate(() => {
    return photos.remove({ uri });
  }, "解除关联失败，请重试。");
}

async function open(uri: string) {
  const token = generation;
  try {
    await photos.open({ uri });
  } catch {
    if (generation === token && props.active) {
      message.value = "原图不可访问，或没有可用的图片查看器。";
    }
  }
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
    if (active) {
      void refresh();
    } else {
      reassignDialog.value?.cancel();
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
  observer?.disconnect();
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
            : "在安卓安装包中添加图片。网页版可预览地图。"
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
          :disabled="!nativePhotos || busy || loading"
          @click="associate"
        >
          <AppIcon v-show="!busy && !loading" name="plus" />
          <LoadingIcon :active="busy || loading" />
        </button>
      </TransitionGroup>
      <PhotoReassignDialog ref="reassignDialog" />
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
