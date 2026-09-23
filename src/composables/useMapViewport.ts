import { computed, onUnmounted, ref, type Ref } from "vue";

import { screenToWorld, zoomView, type Point, type View } from "../domain/viewport";

const pointOf = (event: PointerEvent | WheelEvent) => {
  return { x: event.clientX, y: event.clientY };
};
const doubleTapInterval = 200;

// 手势直接跟手；离散操作使用可打断的相机动画，共用同一个 SVG 坐标系。
export function useMapViewport(
  map: Ref<SVGSVGElement | undefined>,
  callbacks: { onSelect: (point: Point) => void },
) {
  const view = ref<View>({ x: 50, y: 170, width: 690, height: 1240 });
  const viewBox = computed(() => {
    return `${view.value.x} ${view.value.y} ${view.value.width} ${view.value.height}`;
  });
  let frame = 0;
  let destination: View | undefined;
  let tapTimer: ReturnType<typeof setTimeout> | undefined;
  let lastTap: (Point & { time: number }) | undefined;
  let doubleDrag: { start: Point; anchor: Point; view: View } | undefined;
  const pointers = new Map<number, Point>();
  let start: Point = { x: 0, y: 0 };
  let dragged = false;
  let multiTouch = false;
  const world = (point: Point) => {
    return screenToWorld(view.value, map.value!.getBoundingClientRect(), point);
  };

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    destination = undefined;
  }
  function moveTo(next: View) {
    cancelTap();
    stop();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      view.value = next;
      return;
    }
    destination = next;
    const from = { ...view.value };
    const started = performance.now();
    function tick(now: number) {
      const progress = Math.min(1, (now - started) / 320);
      const eased = 1 - (1 - progress) ** 3;
      view.value = {
        x: from.x + (next.x - from.x) * eased,
        y: from.y + (next.y - from.y) * eased,
        width: from.width + (next.width - from.width) * eased,
        height: from.height + (next.height - from.height) * eased,
      };
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
        destination = undefined;
      }
    }
    frame = requestAnimationFrame(tick);
  }

  function setView(next: View) {
    cancelTap();
    stop();
    view.value = next;
  }

  function zoom(factor: number, anchor?: Point) {
    const base = destination ?? view.value;
    moveTo(
      zoomView(base, factor, anchor ?? { x: base.x + base.width / 2, y: base.y + base.height / 2 }),
    );
  }
  function cancelTap() {
    clearTimeout(tapTimer);
    tapTimer = undefined;
    lastTap = undefined;
  }
  function down(event: PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    stop();
    map.value?.setPointerCapture(event.pointerId);
    const point = pointOf(event);
    pointers.set(event.pointerId, point);
    if (pointers.size > 1) {
      cancelTap();
      doubleDrag = undefined;
      multiTouch = true;
      dragged = true;
      return;
    }
    multiTouch = false;
    dragged = false;
    start = point;
    if (
      lastTap &&
      performance.now() - lastTap.time < doubleTapInterval &&
      Math.hypot(point.x - lastTap.x, point.y - lastTap.y) < 28
    ) {
      cancelTap();
      doubleDrag = { start: point, anchor: world(point), view: { ...view.value } };
    } else {
      cancelTap();
      doubleDrag = undefined;
    }
  }
  function move(event: PointerEvent) {
    const before = pointers.get(event.pointerId);
    if (!before) {
      return;
    }
    const point = pointOf(event);
    if (Math.hypot(point.x - start.x, point.y - start.y) > 6) {
      dragged = true;
    }
    const other = [...pointers.entries()].find(([id]) => {
      return id !== event.pointerId;
    })?.[1];
    if (other) {
      const oldDistance = Math.hypot(before.x - other.x, before.y - other.y);
      const nextDistance = Math.hypot(point.x - other.x, point.y - other.y);
      if (oldDistance > 5 && nextDistance > 5) {
        view.value = zoomView(view.value, oldDistance / nextDistance, world(other));
      }
    } else if (doubleDrag) {
      if (dragged) {
        view.value = zoomView(
          doubleDrag.view,
          Math.exp((point.y - doubleDrag.start.y) / 220),
          doubleDrag.anchor,
        );
      }
    } else if (dragged) {
      const from = world(before);
      const to = world(point);
      view.value = {
        ...view.value,
        x: view.value.x + from.x - to.x,
        y: view.value.y + from.y - to.y,
      };
    }
    pointers.set(event.pointerId, point);
  }
  function up(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) {
      return;
    }
    const point = pointOf(event);
    if (doubleDrag && pointers.size === 1) {
      if (!dragged) {
        zoom(0.5, doubleDrag.anchor);
      }
      doubleDrag = undefined;
    } else if (!dragged && !multiTouch && pointers.size === 1) {
      const selection = world(point);
      lastTap = { ...point, time: performance.now() };
      tapTimer = setTimeout(() => {
        callbacks.onSelect(selection);
        lastTap = undefined;
        tapTimer = undefined;
      }, doubleTapInterval);
    }
    pointers.delete(event.pointerId);
  }
  function cancel(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) {
      return;
    }
    pointers.delete(event.pointerId);
    cancelTap();
    doubleDrag = undefined;
    dragged = true;
  }
  function wheel(event: WheelEvent) {
    cancelTap();
    zoom(event.deltaY > 0 ? 1.15 : 0.87, world(pointOf(event)));
  }
  onUnmounted(() => {
    stop();
    cancelTap();
  });
  return { view, viewBox, moveTo, setView, zoom, down, move, up, cancel, wheel };
}
