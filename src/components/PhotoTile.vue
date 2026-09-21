<script setup lang="ts">
import { ContextMenuContent, ContextMenuItem, ContextMenuRoot, ContextMenuTrigger } from "reka-ui";
import { ref } from "vue";

import LoadingIcon from "./ui/LoadingIcon.vue";

defineProps<{ thumbnail?: string; unavailable?: boolean; busy: boolean }>();
const emit = defineEmits<{ open: []; remove: [] }>();

const preview = ref<HTMLElement>();
const menuOpen = ref(false);
// 长按松手不能直接选中刚覆盖到手指下的解除按钮。
const armed = ref(false);
const loaded = ref(false);
const failed = ref(false);

// 参考对象从首次渲染就存在，避免初始空 ref 被组件的属性转发过滤。
const reference = {
  getBoundingClientRect: () => {
    return preview.value!.getBoundingClientRect();
  },
};
</script>

<template>
  <article ref="preview" class="photo-tile">
    <ContextMenuRoot
      @update:open="
        menuOpen = $event;
        armed = false;
      "
    >
      <ContextMenuTrigger as-child :disabled="busy" style="pointer-events: inherit">
        <button
          class="photo-preview"
          aria-label="查看原图"
          :aria-disabled="unavailable || failed"
          @click="!menuOpen && !unavailable && !failed && emit('open')"
        >
          <img
            v-if="thumbnail"
            :src="thumbnail"
            :class="{ loaded }"
            alt="展位贴图缩略图"
            draggable="false"
            @load="loaded = true"
            @error="failed = true"
          />
          <span v-if="unavailable || failed">原图不可访问</span>
          <LoadingIcon :active="!loaded && !unavailable && !failed" />
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent
        as-child
        :reference="reference"
        :avoid-collisions="false"
        position-strategy="absolute"
      >
        <div class="photo-actions">
          <ContextMenuItem
            as="button"
            class="remove-button"
            :disabled="busy"
            @pointerdown="armed = true"
            @pointerup.prevent
            @keydown.enter.capture="armed = true"
            @keydown.space.capture="armed = true"
            @select="armed ? emit('remove') : $event.preventDefault()"
          >
            解除关联
          </ContextMenuItem>
        </div>
      </ContextMenuContent>
    </ContextMenuRoot>
  </article>
</template>

<style scoped>
.photo-tile {
  position: relative;
  min-width: 0;
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
  user-select: none;
}

.photo-preview > * {
  grid-area: 1 / 1;
}

.photo-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
}

.photo-preview img.loaded {
  opacity: 1;
  animation: image-in var(--duration-fast);
}

@keyframes image-in {
  from {
    opacity: 0;
  }
}

.photo-actions {
  display: grid;
  place-items: center;
  width: var(--reka-context-menu-trigger-width);
  height: var(--reka-context-menu-trigger-height);

  /* ContextMenu 默认位于参考元素右侧 2px，移回当前图片内。 */
  transform: translateX(calc(-100% - 2px));
  background: rgb(48 39 29 / 60%);
  border-radius: var(--radius-small);
  z-index: 1;
}

.remove-button {
  min-height: 44px;
  padding: 8px;
  background: transparent;
  color: var(--color-on-primary);
  font-size: 12px;
}
</style>
