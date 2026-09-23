export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SurfaceSize {
  width: number;
  height: number;
}

export type DragOperation = "move" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

const minimumSize = 4;

const clamp = (value: number, minimum: number, maximum: number) => {
  return Math.min(maximum, Math.max(minimum, value));
};

export function constrainBounds(bounds: Bounds, surface: SurfaceSize): Bounds {
  const width = clamp(Math.round(bounds.width), minimumSize, surface.width);
  const height = clamp(Math.round(bounds.height), minimumSize, surface.height);

  return {
    x: clamp(Math.round(bounds.x), 0, surface.width - width),
    y: clamp(Math.round(bounds.y), 0, surface.height - height),
    width,
    height,
  };
}

export function adjustBounds(
  source: Bounds,
  operation: DragOperation,
  delta: { x: number; y: number },
  surface: SurfaceSize,
): Bounds {
  const dx = Math.round(delta.x);
  const dy = Math.round(delta.y);

  if (operation === "move") {
    return constrainBounds({ ...source, x: source.x + dx, y: source.y + dy }, surface);
  }

  const sourceRight = source.x + source.width;
  const sourceBottom = source.y + source.height;
  const movesLeft = operation.includes("w");
  const movesRight = operation.includes("e");
  const movesTop = operation.includes("n");
  const movesBottom = operation.includes("s");
  const left = movesLeft ? clamp(source.x + dx, 0, sourceRight - minimumSize) : source.x;
  const right = movesRight
    ? clamp(sourceRight + dx, source.x + minimumSize, surface.width)
    : sourceRight;
  const top = movesTop ? clamp(source.y + dy, 0, sourceBottom - minimumSize) : source.y;
  const bottom = movesBottom
    ? clamp(sourceBottom + dy, source.y + minimumSize, surface.height)
    : sourceBottom;

  return {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.round(right - left),
    height: Math.round(bottom - top),
  };
}
