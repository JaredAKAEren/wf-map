import { describe, expect, it } from "vite-plus/test";

import { adjustBounds, constrainBounds } from "./geometry";

const surface = { width: 800, height: 1480 };
const booth = { x: 100, y: 200, width: 120, height: 80 };

describe("展位边界校对", () => {
  it("移动时保持尺寸并限制在底图范围内", () => {
    expect(adjustBounds(booth, "move", { x: -150, y: 1300 }, surface)).toEqual({
      x: 0,
      y: 1400,
      width: 120,
      height: 80,
    });
  });

  it("拖动各方向边界时保留未操作的边", () => {
    expect(adjustBounds(booth, "nw", { x: -10, y: 15 }, surface)).toEqual({
      x: 90,
      y: 215,
      width: 130,
      height: 65,
    });
    expect(adjustBounds(booth, "se", { x: 20, y: 30 }, surface)).toEqual({
      x: 100,
      y: 200,
      width: 140,
      height: 110,
    });
  });

  it("输入坐标会取整并限制最小尺寸和底图范围", () => {
    expect(constrainBounds({ x: 799.8, y: -2, width: 0, height: 2000 }, surface)).toEqual({
      x: 796,
      y: 0,
      width: 4,
      height: 1480,
    });
  });
});
