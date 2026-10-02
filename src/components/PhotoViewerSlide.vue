<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

import type { PhotoTransform } from "../composables/usePhotoViewerGestures";
import { photos, type Photo } from "../services/photos";
import AppIcon from "./ui/AppIcon.vue";
import LoadingIcon from "./ui/LoadingIcon.vue";

const props = defineProps<{
  photo: Photo & { thumbnail?: string };
  position: number;
  active: boolean;
  interacting: boolean;
  transform: PhotoTransform;
}>();
const emit = defineEmits<{
  loaded: [size: { width: number; height: number }];
  unavailable: [];
}>();

const url = ref("");
const loaded = ref(false);
const failed = ref(false);
let disposed = false;

async function load() {
  try {
    const blob = await photos.original({ uri: props.photo.uri });
    if (!disposed) {
      url.value = URL.createObjectURL(blob);
    }
  } catch {
    if (!disposed) {
      failed.value = true;
      emit("unavailable");
    }
  }
}

function imageLoaded(event: Event) {
  const image = event.target as HTMLImageElement;
  loaded.value = true;
  emit("loaded", { width: image.naturalWidth, height: image.naturalHeight });
}

function imageFailed() {
  failed.value = true;
  emit("unavailable");
}

const imageStyle = computed(() => {
  const view = props.transform;

  return { transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` };
});

onMounted(() => {
  void load();
});

onUnmounted(() => {
  disposed = true;
  if (url.value) {
    URL.revokeObjectURL(url.value);
  }
  emit("unavailable");
});
</script>

<template>
  <div
    class="viewer-slide"
    :data-active="active"
    :data-interacting="interacting"
    :aria-hidden="!active"
    :aria-busy="!loaded && !failed"
  >
    <img
      v-if="photo.thumbnail && !loaded"
      :src="photo.thumbnail"
      class="viewer-thumbnail"
      alt=""
      :draggable="false"
    />
    <img
      v-if="url && !failed"
      :src="url"
      :alt="`展位贴图原图 ${position + 1}`"
      class="viewer-image"
      :class="{ 'image-ready': loaded }"
      :style="imageStyle"
      :draggable="false"
      @load="imageLoaded"
      @error="imageFailed"
    />
    <LoadingIcon class="viewer-loading" :active="!loaded && !failed" />
    <AppIcon
      v-if="failed"
      class="viewer-unavailable"
      name="image"
      role="img"
      aria-label="原图不可访问"
      :aria-hidden="false"
    />
  </div>
</template>

<style scoped>
.viewer-slide {
  overflow: hidden;
}

.viewer-image,
.viewer-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.viewer-image {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: transform var(--duration-fast);
}

.viewer-image.image-ready {
  opacity: 1;
}

.viewer-slide[data-interacting="true"] .viewer-image {
  transition: none;
}

.viewer-loading,
.viewer-unavailable {
  position: absolute;
  top: 50%;
  left: 50%;
  color: #fff;
  transform: translate(-50%, -50%);
}
</style>
