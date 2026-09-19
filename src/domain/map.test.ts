import { describe, expect, it } from "vite-plus/test";

import { booths } from "../data/exhibition";
import { searchBooths } from "./map";

describe("展位查找与位置", () => {
  it("名称漏字仍找到目标，完全无关输入不移动到任意展位", () => {
    expect(searchBooths("amimi", booths)[0]?.code).toBe("A28");
    expect(searchBooths("xyz987xyz", booths)).toEqual([]);
  });
  it("同一展位的多个品牌均能找到，编号必须准确匹配", () => {
    expect(searchBooths("KURO GAMES", booths)[0]?.code).toBe("A25");
    expect(searchBooths("HanaB", booths)[0]?.code).toBe("A25");
    expect(searchBooths("A02", booths)).toEqual([]);
    expect(searchBooths("A47", booths)[0]?.names).toEqual(["宸玑研造"]);
    expect(searchBooths("W5 A28", booths)[0]?.id).toBe("wf2026/W5/A28");
  });
  it("本届 W5 新增名称和清晰别名均可检索", () => {
    expect(searchBooths("SnailShell", booths)[0]?.code).toBe("A30");
    expect(searchBooths("Reverse Studio", booths)[0]?.code).toBe("A28");
    expect(searchBooths("海雅玩具", booths)[0]?.code).toBe("A32");
    expect(searchBooths("NiyruLoi", booths)[0]?.code).toBe("A10");
    expect(searchBooths("Tinyfox", booths)).toEqual([]);
  });
  it("支持中文单字、全拼、拼音首字母和独立英文名容错", () => {
    expect(
      searchBooths("海", booths).map((entry) => {
        return entry.code;
      }),
    ).toEqual(["A32", "A37"]);
    expect(searchBooths("haiyangtang", booths)[0]?.code).toBe("A37");
    expect(searchBooths("hai yang tang", booths)[0]?.code).toBe("A37");
    expect(searchBooths("hyt", booths)[0]?.code).toBe("A37");
    expect(searchBooths("sushng", booths)[0]?.code).toBe("A48");
    expect(searchBooths("h", booths)).toEqual([]);
  });
  it("纯数字精确匹配编号并保留较低优先级的品牌结果", () => {
    expect(searchBooths("1", booths)[0]?.code).toBe("A01");
    expect(searchBooths("01", booths)[0]?.code).toBe("A01");
    expect(searchBooths("2", booths)).toEqual([]);

    const source = booths[0]!;
    const entries = [
      { ...source, id: "w1-a52", hall: "W1", code: "A52", names: ["W1 Booth"] },
      { ...source, id: "w5-a52", hall: "W5", code: "A52", names: ["W5 Booth"] },
      { ...source, id: "brand", hall: "W5", code: "A01", names: ["52TOYS"] },
    ];

    expect(
      searchBooths("52", entries, "W5").map((entry) => {
        return entry.id;
      }),
    ).toEqual(["w5-a52", "w1-a52", "brand"]);
  });
  it("准确匹配优先于包含，同名结果优先当前查看馆，且不修改输入顺序", () => {
    const source = booths[0]!;
    const entries = [
      { ...source, id: "one", hall: "W1", names: ["Test Brand"] },
      { ...source, id: "two", hall: "W2", names: ["Test Brand"] },
      { ...source, id: "three", hall: "W2", names: ["Test Brand Extra"] },
    ];
    Object.freeze(entries);

    expect(
      searchBooths("Test Brand", entries, "W2").map((entry) => {
        return entry.id;
      }),
    ).toEqual(["two", "one", "three"]);
  });
});
