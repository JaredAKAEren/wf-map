import { onUnmounted, ref } from "vue";

export function usePhotoViewerCarousel(
  width: () => number,
  callbacks: { canStep: (direction: number) => boolean; select: (direction: number) => void },
) {
  const offset = ref(0);
  const settling = ref(false);
  const gap = 16;
  let frame = 0;

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    settling.value = false;
  }

  function animate(direction: number) {
    stop();
    const from = offset.value;
    const to = direction ? -direction * (width() + gap) : 0;

    function finish() {
      frame = 0;
      settling.value = false;
      offset.value = 0;
      if (direction) {
        callbacks.select(direction);
      }
    }

    if (from === to || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();

      return;
    }

    settling.value = true;
    const started = performance.now();

    function tick(now: number) {
      const progress = Math.min(1, (now - started) / 260);
      const eased = 1 - (1 - progress) ** 3;
      offset.value = from + (to - from) * eased;
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        finish();
      }
    }

    frame = requestAnimationFrame(tick);
  }

  function begin() {
    stop();

    return offset.value;
  }

  function drag(distance: number) {
    const direction = distance < 0 ? 1 : -1;
    const extent = width() + gap;
    offset.value = callbacks.canStep(direction)
      ? Math.max(-extent, Math.min(extent, distance))
      : (distance * 0.28) / (1 + Math.abs(distance) / Math.max(1, width()));
  }

  function settle(velocity = 0) {
    const distance = offset.value;
    const direction = distance < 0 ? 1 : -1;
    const flick =
      Math.abs(distance) > 40 &&
      Math.abs(velocity) > 0.45 &&
      Math.sign(velocity) === Math.sign(distance);
    const advance =
      callbacks.canStep(direction) && (Math.abs(distance) >= Math.min(160, width() * 0.2) || flick);
    animate(advance ? direction : 0);
  }

  function step(direction: number) {
    if (callbacks.canStep(direction)) {
      animate(direction);
    }
  }

  function cancel() {
    animate(0);
  }

  function reset() {
    stop();
    offset.value = 0;
  }

  onUnmounted(reset);

  return { offset, settling, gap, begin, drag, settle, step, cancel, reset };
}
