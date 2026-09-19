export type Point = { x: number; y: number };
export type View = Point & { width: number; height: number };

export function zoomView(view: View, factor: number, anchor: Point): View {
  const width = Math.max(160, Math.min(6000, view.width * factor));
  const ratio = width / view.width;
  return {
    x: anchor.x - (anchor.x - view.x) * ratio,
    y: anchor.y - (anchor.y - view.y) * ratio,
    width,
    height: view.height * ratio,
  };
}

export function screenToWorld(
  view: View,
  rect: { left: number; top: number; width: number; height: number },
  point: Point,
): Point {
  const scale = Math.min(rect.width / view.width, rect.height / view.height);
  return {
    x: view.x + (point.x - rect.left - (rect.width - view.width * scale) / 2) / scale,
    y: view.y + (point.y - rect.top - (rect.height - view.height * scale) / 2) / scale,
  };
}
