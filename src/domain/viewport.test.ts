import { describe, expect, it } from "vite-plus/test";

import { screenToWorld, zoomView } from "./viewport";

describe("地图视野", () => {
  it("宽高比留白下屏幕坐标仍命中同一底图坐标", () => {
    const view = { x: 100, y: 200, width: 400, height: 800 };
    const rect = { left: 10, top: 20, width: 400, height: 400 };
    expect(screenToWorld(view, rect, { x: 210, y: 220 })).toEqual({ x: 300, y: 600 });
    expect(screenToWorld(view, rect, { x: 110, y: 20 })).toEqual({ x: 100, y: 200 });
  });
  it("缩放锚点不漂移，连续缩放保持比例且限制范围", () => {
    const view = { x: 100, y: 200, width: 400, height: 800 };
    const anchor = { x: 200, y: 400 };
    const next = zoomView(view, 0.5, anchor);
    expect(next).toEqual({ x: 150, y: 300, width: 200, height: 400 });
    expect((anchor.x - next.x) / next.width).toBe((anchor.x - view.x) / view.width);
    expect(zoomView(next, 0.01, anchor).width).toBe(160);
    expect(zoomView(view, 100, anchor)).toMatchObject({ width: 6000, height: 12000 });
  });
});
