import { onUnmounted, ref, type Ref } from "vue";

import type { usePhotoViewerCarousel } from "./usePhotoViewerCarousel";
import type { usePhotoViewerDismiss } from "./usePhotoViewerDismiss";

interface Point {
  x: number;
  y: number;
}
export interface PhotoTransform extends Point {
  scale: number;
}
interface Gesture {
  start: Point;
  transform: PhotoTransform;
  startedAt: number;
  moved: boolean;
  multiple: boolean;
  zoomed: boolean;
  doubleTap: boolean;
  axis?: "horizontal" | "vertical";
  offset: number;
  dismissOffset: number;
  lastPoint: Point & { time: number };
  velocity: Point;
}
interface Pinch {
  center: Point;
  distance: number;
  transform: PhotoTransform;
}

// 单点退出延后到双击判断结束，拖动和双指操作会取消待处理的单点。
const doubleTapInterval = 300;

export function usePhotoViewerGestures(
  stage: Ref<HTMLElement | undefined>,
  bounds: () => { width: number; height: number; imageWidth: number; imageHeight: number },
  carousel: ReturnType<typeof usePhotoViewerCarousel>,
  dismiss: ReturnType<typeof usePhotoViewerDismiss>,
  callbacks: { close: () => void; ready: () => boolean },
) {
  const transform = ref<PhotoTransform>({ x: 0, y: 0, scale: 1 });
  const interacting = ref(false);
  const pointers = new Map<number, Point>();
  let gesture: Gesture | undefined;
  let pinch: Pinch | undefined;
  let lastTap: (Point & { time: number }) | undefined;
  let tapTimer: ReturnType<typeof setTimeout> | undefined;

  function cancelTap() {
    clearTimeout(tapTimer);
    tapTimer = undefined;
    lastTap = undefined;
  }

  function constrain(next: PhotoTransform) {
    const size = bounds();
    const limitX = Math.max(0, (size.imageWidth * next.scale - size.width) / 2);
    const limitY = Math.max(0, (size.imageHeight * next.scale - size.height) / 2);
    transform.value = {
      scale: next.scale,
      x: Math.max(-limitX, Math.min(limitX, next.x)),
      y: Math.max(-limitY, Math.min(limitY, next.y)),
    };
  }

  function localPoint(event: PointerEvent | WheelEvent): Point {
    const rect = stage.value!.getBoundingClientRect();

    return {
      x: event.clientX - rect.x - rect.width / 2,
      y: event.clientY - rect.y - rect.height / 2,
    };
  }

  function zoom(scale: number, anchor: Point) {
    cancelTap();
    const previous = transform.value;
    const nextScale = Math.max(1, Math.min(6, scale));
    const factor = nextScale / previous.scale;
    constrain({
      scale: nextScale,
      x: anchor.x - (anchor.x - previous.x) * factor,
      y: anchor.y - (anchor.y - previous.y) * factor,
    });
  }

  function toggleZoom(anchor: Point = { x: 0, y: 0 }) {
    if (callbacks.ready()) {
      zoom(transform.value.scale > 1 ? 1 : 2.5, anchor);
    }
  }

  function pinchGeometry() {
    const [first, second] = [...pointers.values()];
    if (!first || !second) {
      return undefined;
    }

    return {
      center: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
      distance: Math.hypot(first.x - second.x, first.y - second.y),
    };
  }

  function down(event: PointerEvent) {
    if (event.button !== 0 || !stage.value || dismiss.closing.value) {
      return;
    }

    event.preventDefault();
    const point = localPoint(event);
    if (pointers.size === 0) {
      const offset = carousel.begin();
      const dismissOffset = dismiss.begin();
      gesture = {
        start: point,
        transform: { ...transform.value },
        startedAt: performance.now(),
        moved: Math.abs(offset) > 1 || Math.abs(dismissOffset) > 1,
        multiple: false,
        zoomed: transform.value.scale > 1,
        doubleTap:
          !!lastTap &&
          performance.now() - lastTap.time < doubleTapInterval &&
          Math.hypot(point.x - lastTap.x, point.y - lastTap.y) < 28,
        axis:
          Math.abs(offset) > 1
            ? "horizontal"
            : Math.abs(dismissOffset) > 1
              ? "vertical"
              : undefined,
        offset,
        dismissOffset,
        lastPoint: { ...point, time: performance.now() },
        velocity: { x: 0, y: 0 },
      };
    }
    cancelTap();
    pointers.set(event.pointerId, point);
    stage.value.setPointerCapture(event.pointerId);
    interacting.value = true;
    if (pointers.size > 1 && gesture) {
      gesture.multiple = true;
      gesture.doubleTap = false;
      carousel.reset();
      dismiss.reset();
      const geometry = pinchGeometry();
      if (geometry) {
        pinch = { ...geometry, transform: { ...transform.value } };
      }
    }
  }

  function move(event: PointerEvent) {
    if (!pointers.has(event.pointerId) || !gesture) {
      return;
    }

    const point = localPoint(event);
    pointers.set(event.pointerId, point);
    const dx = point.x - gesture.start.x;
    const dy = point.y - gesture.start.y;
    const now = performance.now();
    const duration = Math.max(1, now - gesture.lastPoint.time);
    gesture.velocity = {
      x: (point.x - gesture.lastPoint.x) / duration,
      y: (point.y - gesture.lastPoint.y) / duration,
    };
    gesture.lastPoint = { ...point, time: now };
    gesture.moved ||= Math.hypot(dx, dy) > 10;
    if (pointers.size > 1 && pinch && callbacks.ready()) {
      const geometry = pinchGeometry();
      if (geometry && pinch.distance > 10) {
        const scale = Math.max(
          1,
          Math.min(6, (pinch.transform.scale * geometry.distance) / pinch.distance),
        );
        const factor = scale / pinch.transform.scale;
        constrain({
          scale,
          x: geometry.center.x - (pinch.center.x - pinch.transform.x) * factor,
          y: geometry.center.y - (pinch.center.y - pinch.transform.y) * factor,
        });
      }
    } else if (gesture.zoomed || gesture.multiple) {
      if (callbacks.ready()) {
        constrain({
          ...gesture.transform,
          x: gesture.transform.x + dx,
          y: gesture.transform.y + dy,
        });
      }
    } else if (gesture.moved) {
      gesture.axis ??= Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      if (gesture.axis === "horizontal") {
        carousel.drag(gesture.offset + dx);
      } else {
        dismiss.drag(gesture.dismissOffset + dy);
      }
    }
  }

  function up(event: PointerEvent) {
    if (!pointers.has(event.pointerId) || !gesture) {
      return;
    }

    const point = localPoint(event);
    const current = gesture;
    pointers.delete(event.pointerId);
    if (stage.value?.hasPointerCapture(event.pointerId)) {
      stage.value.releasePointerCapture(event.pointerId);
    }
    if (pointers.size) {
      current.start = [...pointers.values()][0]!;
      current.transform = { ...transform.value };
      current.moved = true;
      current.zoomed = transform.value.scale > 1;
      const geometry = pinchGeometry();
      pinch = geometry ? { ...geometry, transform: { ...transform.value } } : undefined;

      return;
    }

    interacting.value = false;
    gesture = undefined;
    pinch = undefined;
    if (current.multiple) {
      return;
    }

    const dx = point.x - current.start.x;
    const dy = point.y - current.start.y;
    if (current.moved || Math.hypot(dx, dy) > 10) {
      const recent = performance.now() - current.lastPoint.time < 80;
      if (!current.zoomed && current.axis === "horizontal") {
        carousel.settle(recent ? current.velocity.x : 0);
      } else if (!current.zoomed && current.axis === "vertical") {
        dismiss.settle(recent ? current.velocity.y : 0);
      } else {
        carousel.settle();
        dismiss.cancel();
      }

      return;
    }
    if (performance.now() - current.startedAt > 500) {
      return;
    }
    if (current.doubleTap) {
      toggleZoom(point);

      return;
    }

    lastTap = { ...point, time: performance.now() };
    tapTimer = setTimeout(() => {
      cancelTap();
      if (transform.value.scale === 1 && !carousel.settling.value && !dismiss.settling.value) {
        callbacks.close();
      }
    }, doubleTapInterval);
  }

  function cancel(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) {
      return;
    }

    cancelTap();
    pointers.delete(event.pointerId);
    if (gesture) {
      gesture.multiple = true;
      gesture.moved = true;
      gesture.start = [...pointers.values()][0] ?? gesture.start;
      gesture.transform = { ...transform.value };
    }
    const geometry = pinchGeometry();
    pinch = geometry ? { ...geometry, transform: { ...transform.value } } : undefined;
    carousel.cancel();
    dismiss.cancel();
    interacting.value = pointers.size > 0;
  }

  function wheel(event: WheelEvent) {
    if (!callbacks.ready() || event.deltaY === 0 || dismiss.closing.value) {
      return;
    }

    dismiss.reset();
    zoom(transform.value.scale * Math.exp(-Math.sign(event.deltaY) * 0.18), localPoint(event));
  }

  function reset() {
    cancelTap();
    for (const id of pointers.keys()) {
      if (stage.value?.hasPointerCapture(id)) {
        stage.value.releasePointerCapture(id);
      }
    }
    pointers.clear();
    gesture = undefined;
    pinch = undefined;
    interacting.value = false;
    carousel.reset();
    dismiss.reset();
    transform.value = { x: 0, y: 0, scale: 1 };
  }

  onUnmounted(reset);

  return { transform, interacting, down, move, up, cancel, wheel, reset };
}
