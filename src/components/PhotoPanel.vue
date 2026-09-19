<script setup lang="ts">
import { ref, watch } from "vue";

import { booths, type Booth } from "../data/exhibition";
import { nativePhotos, photos, type Photo } from "../services/photos";

const props = defineProps<{ booth: Booth }>();
const items = ref<(Photo & { thumbnail?: string; unavailable?: boolean })[]>([]);
const busy = ref(false);
const message = ref("");
let request = 0;
async function refresh() {
  const token = ++request;
  items.value = [];
  if (!nativePhotos) {
    return;
  }
  try {
    const result = await photos.list({ boothId: props.booth.id });
    if (request !== token) {
      return;
    }
    items.value = result.photos;
    for (const item of result.photos) {
      if (request !== token) {
        return;
      }
      try {
        const preview = await photos.thumbnail({ uri: item.uri });
        if (request !== token) {
          return;
        }
        const target = items.value.find((entry) => {
          return entry.uri === item.uri;
        });
        if (target) {
          target.thumbnail = preview.dataUrl;
        }
      } catch {
        const target = items.value.find((entry) => {
          return entry.uri === item.uri;
        });
        if (target && request === token) {
          target.unavailable = true;
        }
      }
    }
  } catch {
    message.value = "暂时无法读取关联记录，请重试。";
  }
}
async function associate() {
  const booth = props.booth;
  busy.value = true;
  message.value = "";
  let uris: string[] = [];
  try {
    const result = await photos.pick();
    uris = result.uris;
    for (const uri of uris) {
      const response = await photos.assign({ uri, boothId: booth.id, replace: false });
      if (response.conflict) {
        const old = booths.find((entry) => {
          return entry.id === response.conflict;
        });
        if (
          window.confirm(
            `这张照片已关联 ${old ? old.hall + " " + old.code : response.conflict}。改为 ${booth.hall} ${booth.code}？`,
          )
        ) {
          await photos.assign({ uri, boothId: booth.id, replace: true });
        }
      }
    }
    message.value = result.failed
      ? `${result.failed} 张照片未能取得长期读取权限，请重新选择。`
      : "";
  } catch {
    message.value = "关联未完成，请重试。已保存的记录会保留。";
  } finally {
    try {
      await photos.releaseUnlinked({ uris });
    } catch {
      message.value = "未关联照片的授权释放失败。";
    }
    busy.value = false;
    await refresh();
  }
}
async function remove(uri: string) {
  try {
    await photos.remove({ uri });
    await refresh();
  } catch {
    message.value = "解除关联失败，请重试。";
  }
}
async function open(uri: string) {
  try {
    await photos.open({ uri });
  } catch {
    message.value = "原照片不可访问，或没有可用的照片查看器。";
  }
}
watch(
  () => {
    return props.booth.id;
  },
  () => {
    message.value = "";
    void refresh();
  },
  { immediate: true },
);
</script>

<template>
  <section class="photos" aria-label="展位照片">
    <div class="section-heading">
      <h3>
        展位照片 <span>{{ items.length }}</span>
      </h3>
      <button class="text-button" :disabled="!nativePhotos || busy" @click="associate">
        {{ busy ? "正在关联…" : "＋ 关联照片" }}
      </button>
    </div>
    <p v-if="!nativePhotos" class="muted">在安卓安装包中选择系统相册照片。网页版可预览地图。</p>
    <p v-else-if="!items.length" class="muted">拍照后回来，把照片关联到这个展位。</p>
    <p v-if="message" role="status" class="notice">{{ message }}</p>
    <div class="photo-grid">
      <article v-for="item in items" :key="item.uri">
        <button
          class="photo-preview"
          :disabled="item.unavailable"
          aria-label="查看原照片"
          @click="open(item.uri)"
        >
          <img v-if="item.thumbnail" :src="item.thumbnail" alt="关联照片缩略图" /><span v-else>{{
            item.unavailable ? "原图不可访问" : "正在读取…"
          }}</span>
        </button>
        <button class="text-button" @click="remove(item.uri)">解除关联</button>
      </article>
    </div>
  </section>
</template>

<style scoped>
.photos {
  border-top: 1px solid var(--color-border);
  margin-top: 12px;
  padding-top: 14px;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

h3 {
  font-size: 13px;
}

h3 span {
  font-weight: 400;
  color: var(--color-muted);
}

.muted {
  margin: 8px 0;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.photo-preview {
  display: grid;
  place-items: center;
  padding: 0;
  background: var(--color-accent-soft);
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--radius-small);
  font-size: 11px;
}

.photo-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
