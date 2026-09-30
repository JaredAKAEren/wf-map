import { describe, expect, it } from "vite-plus/test";

import type { Booth } from "../data/exhibition";
import { filterBooths } from "./booth-filter";

const booths: Booth[] = [
  {
    id: "w1-a10",
    hall: "W1",
    code: "A10",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    entries: [{ names: ["测试工作室"], searchTerms: [] }],
  },
  {
    id: "w1-a2",
    hall: "W1",
    code: "A2",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    entries: [{ names: ["测试"], searchTerms: [] }],
  },
  {
    id: "w5-a1",
    hall: "W5",
    code: "A1",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    entries: [
      { names: ["测试工作室"], searchTerms: [], slot: "01" },
      { names: [], searchTerms: [], slot: "02" },
    ],
  },
];
const photoIds = new Set(["w1-a10", "w5-a1"]);
const favoriteIds = new Set(["w1-a10", "w1-a2"]);

function ids(results: ReturnType<typeof filterBooths>) {
  return results.map((result) => {
    return result.booth.id;
  });
}

describe("展位筛选", () => {
  it("空查询展示筛选结果，多选取交集，未选择时保持搜索提示", () => {
    expect(
      ids(
        filterBooths("", booths, { photos: true, favorites: false }, photoIds, favoriteIds, "W5"),
      ),
    ).toEqual(["w5-a1", "w1-a10"]);
    expect(
      ids(filterBooths("", booths, { photos: true, favorites: true }, photoIds, favoriteIds)),
    ).toEqual(["w1-a10"]);
    expect(
      filterBooths("", booths, { photos: false, favorites: false }, photoIds, favoriteIds),
    ).toEqual([]);
    expect(
      filterBooths("", booths, { photos: true, favorites: true }, new Set(), favoriteIds),
    ).toEqual([]);
  });

  it("编号按数值排列且不改变传入的数据顺序", () => {
    expect(
      ids(filterBooths(" ", booths, { photos: false, favorites: true }, photoIds, favoriteIds)),
    ).toEqual(["w1-a2", "w1-a10"]);
    expect(
      booths.map((booth) => {
        return booth.id;
      }),
    ).toEqual(["w1-a10", "w1-a2", "w5-a1"]);
  });

  it("关键词仅在筛选范围搜索，匹配程度优先于当前馆", () => {
    const all = new Set(
      booths.map((booth) => {
        return booth.id;
      }),
    );
    expect(
      ids(filterBooths("测试", booths, { photos: false, favorites: true }, photoIds, all, "W5")),
    ).toEqual(["w1-a2", "w5-a1", "w1-a10"]);
    expect(
      filterBooths("W5A1", booths, { photos: false, favorites: true }, photoIds, favoriteIds),
    ).toEqual([]);
  });

  it("细分展商共享区域筛选状态，空名细分编号仍可检索", () => {
    const results = filterBooths(
      "W5-A1-02",
      booths,
      { photos: true, favorites: false },
      photoIds,
      favoriteIds,
    );
    expect(results).toEqual([{ booth: booths[2], entry: booths[2]!.entries[1] }]);
    expect(
      filterBooths("W5-A1-02", booths, { photos: true, favorites: true }, photoIds, favoriteIds),
    ).toEqual([]);
  });
});
