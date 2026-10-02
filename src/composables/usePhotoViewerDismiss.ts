import { computed, onUnmounted, ref } from "vue";

export function usePhotoViewerDismiss(height: () => number, close: () => void) {
  const offset = ref(0);
  const settling = ref(false);
  const closing = ref(false);
  let frame = 0;
  let maxDistance = 0;
  let reversed = false;

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    settling.value = false;
  }

  function animate(shouldClose: boolean) {
    stop();
    closing.value = shouldClose;
    const from = offset.value;
    const to = shouldClose ? height() : 0;

    function finish() {
      frame = 0;
      offset.value = to;
      settling.value = false;
      if (shouldClose) {
        close();
      }
    }

    if (from === to || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();

      return;
    }

    settling.value = true;
    const started = performance.now();

    function tick(now: number) {
      const progress = Math.min(1, (now - started) / 240);
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
    maxDistance = Math.max(0, offset.value);
    reversed = false;

    return offset.value;
  }

  function drag(distance: number) {
    maxDistance = Math.max(maxDistance, distance);
    // 用户明显往回拖时取消退出意图，即使松手时仍超过关闭距离。
    reversed ||= maxDistance > 60 && maxDistance - distance > 24;
    offset.value = distance >= 0 ? distance : -Math.sqrt(-distance) * 2;
  }

  function settle(velocity = 0) {
    const distance = offset.value;
    const threshold = Math.min(140, height() * 0.2);
    const flick = distance > 40 && velocity > 0.65;
    animate(!reversed && (distance >= threshold || flick));
  }

  function cancel() {
    animate(false);
  }

  function reset() {
    stop();
    offset.value = 0;
    closing.value = false;
    maxDistance = 0;
    reversed = false;
  }

  const progress = computed(() => {
    return Math.max(0, offset.value) / Math.max(1, height());
  });
  const scale = computed(() => {
    return 1 - Math.min(0.15, progress.value * 0.2);
  });
  const opacity = computed(() => {
    return Math.max(0, 1 - progress.value / 0.65);
  });

  onUnmounted(reset);

  return { offset, settling, closing, scale, opacity, begin, drag, settle, cancel, reset };
}
