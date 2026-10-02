<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";

import { usePhotoViewerCarousel } from "../composables/usePhotoViewerCarousel";
import { usePhotoViewerDismiss } from "../composables/usePhotoViewerDismiss";
import { usePhotoViewerGestures } from "../composables/usePhotoViewerGestures";
import type { Photo } from "../services/photos";
import PhotoViewerSlide from "./PhotoViewerSlide.vue";

const props = defineProps<{ items: readonly Photo[]; initialUri: string }>();
const emit = defineEmits<{ close: [] }>();

const dialog = ref<HTMLDialogElement>();
const stage = ref<HTMLElement>();
const uri = ref(props.initialUri);
const stageSize = ref({ width: 0, height: 0 });
const imageSizes = reactive(new Map<string, { width: number; height: number }>());
const fittedTransform = { x: 0, y: 0, scale: 1 };
let closed = false;
let observer: ResizeObserver | undefined;

const index = computed(() => {
  return props.items.findIndex((item) => {
    return item.uri === uri.value;
  });
});

const carousel = usePhotoViewerCarousel(
  () => {
    return stageSize.value.width;
  },
  {
    canStep: (direction) => {
      return !!props.items[index.value + direction];
    },
    select: (direction) => {
      const next = props.items[index.value + direction];
      if (next) {
        uri.value = next.uri;
      }
    },
  },
);
const dismiss = usePhotoViewerDismiss(() => {
  return stageSize.value.height;
}, close);
const { transform, interacting, down, move, up, cancel, wheel, reset } = usePhotoViewerGestures(
  stage,
  () => {
    const natural = imageSizes.get(uri.value);
    const size = stageSize.value;
    const fit = natural ? Math.min(size.width / natural.width, size.height / natural.height) : 0;

    return {
      ...size,
      imageWidth: (natural?.width ?? 0) * fit,
      imageHeight: (natural?.height ?? 0) * fit,
    };
  },
  carousel,
  dismiss,
  {
    close,
    ready: () => {
      return imageSizes.has(uri.value);
    },
  },
);

function close() {
  if (closed) {
    return;
  }

  closed = true;
  reset();
  dialog.value?.close();
  emit("close");
}

function keydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    close();

    return;
  }

  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    event.stopPropagation();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    if (!props.items[index.value + direction]) {
      return;
    }

    reset();
    carousel.step(direction);
  }
}

function preventMultiTouch(event: TouchEvent) {
  if (event.touches.length > 1) {
    event.preventDefault();
  }
}

function preventBrowserGesture(event: Event) {
  event.preventDefault();
}

const slides = computed(() => {
  return props.items
    .map((photo, position) => {
      return { photo, position };
    })
    .filter((slide) => {
      return Math.abs(slide.position - index.value) <= 1;
    });
});
const trackStyle = computed(() => {
  return {
    transform: `translate(${carousel.offset.value}px, ${dismiss.offset.value}px) scale(${dismiss.scale.value})`,
  };
});

watch(uri, reset);
watch(index, (value) => {
  if (value < 0) {
    close();
  }
});

onMounted(() => {
  dialog.value?.showModal();
  observer = new ResizeObserver(([entry]) => {
    if (entry) {
      stageSize.value = { width: entry.contentRect.width, height: entry.contentRect.height };
      reset();
    }
  });
  if (stage.value) {
    observer.observe(stage.value);
  }
});

onUnmounted(() => {
  closed = true;
  observer?.disconnect();
});
</script>

<template>
  <dialog
    ref="dialog"
    class="photo-viewer"
    :style="{ '--viewer-backdrop-opacity': dismiss.opacity.value }"
    aria-label="展位贴图原图"
    @cancel.prevent="close"
    @close="close"
    @keydown="keydown"
    @touchstart="preventMultiTouch"
    @touchmove.prevent="preventBrowserGesture"
    @gesturestart="preventBrowserGesture"
    @gesturechange="preventBrowserGesture"
    @wheel.prevent
  >
    <div
      ref="stage"
      class="viewer-stage"
      :data-zoomed="transform.scale > 1"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="cancel"
      @lostpointercapture="cancel"
      @dblclick.prevent
      @wheel.prevent="wheel"
      @contextmenu.prevent
    >
      <div class="viewer-track" :style="trackStyle">
        <PhotoViewerSlide
          v-for="slide in slides"
          :key="slide.photo.uri"
          :photo="slide.photo"
          :position="slide.position"
          :active="slide.position === index"
          :interacting="interacting"
          :transform="slide.position === index ? transform : fittedTransform"
          :style="{
            transform: `translateX(${(slide.position - index) * (stageSize.width + carousel.gap)}px)`,
          }"
          @loaded="imageSizes.set(slide.photo.uri, $event)"
          @unavailable="imageSizes.delete(slide.photo.uri)"
        />
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.photo-viewer {
  position: fixed;
  inset: 0;
  width: 100%;
  max-width: none;
  height: 100dvh;
  max-height: none;
  margin: 0;
  border: 0;
  padding: 0;
  overflow: hidden;
  background: rgb(22 18 14 / var(--viewer-backdrop-opacity, 1));
  color: #fff;
  touch-action: none;
  overscroll-behavior: contain;
  user-select: none;
  -webkit-touch-callout: none;
}

.photo-viewer::backdrop {
  background: transparent;
}

.viewer-stage,
.viewer-track,
.viewer-slide {
  position: absolute;
  inset: 0;
}

.viewer-stage {
  overflow: hidden;
  cursor: zoom-in;
  touch-action: none;
}

.viewer-stage[data-zoomed="true"] {
  cursor: grab;
}

.viewer-stage[data-zoomed="true"]:active {
  cursor: grabbing;
}

.viewer-track {
  will-change: transform;
}
</style>
