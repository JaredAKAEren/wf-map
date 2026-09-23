import { describe, expect, it } from "vite-plus/test";

import { w1 } from "../../data/exhibition/w1";
import { reviewColumns, sourceRowCrops } from "./review-data";
import { reviewedDecisions } from "./reviewed-decisions";

describe("W1 逐列校对数据", () => {
  it("13 列覆盖目前核出的 620 个原图编号，并包含所有已录入编号", () => {
    const columnIds = reviewColumns.flatMap((column) => {
      return column.rows.map((row) => {
        return row.id;
      });
    });
    const sourceIds = w1.flatMap((booth) => {
      return booth.entries.map((entry) => {
        return `W1-${booth.code}-${entry.slot}`;
      });
    });

    expect(reviewColumns).toHaveLength(13);
    expect(columnIds).toHaveLength(620);
    expect(new Set(columnIds).size).toBe(620);
    expect(new Set(columnIds)).toEqual(new Set(sourceRowCrops.keys()));
    for (const id of sourceIds) {
      expect(sourceRowCrops.has(id)).toBe(true);
    }
  });

  it("D3-09 保留编号并回填校对名称", () => {
    const d3 = w1.find((booth) => {
      return booth.code === "D3";
    });

    expect(d3?.entries.at(-1)?.slot).toBe("09");
    expect(d3?.entries.at(-1)?.names).toEqual(["遮易速预裁切遮盖"]);
    expect(sourceRowCrops.has("W1-D3-09")).toBe(true);
  });

  it("G2-08 对应原图中的缪斯象限", () => {
    const g2 = w1.find((booth) => {
      return booth.code === "G2";
    });

    expect(g2?.entries.at(-1)?.slot).toBe("08");
    expect(g2?.entries.at(-1)?.names[0]).toBe("缪斯象限");
    expect(sourceRowCrops.has("W1-G2-08")).toBe(true);
  });

  it("H1 只到 12，原图没有 H1-13", () => {
    expect(sourceRowCrops.has("W1-H1-12")).toBe(true);
    expect(sourceRowCrops.has("W1-H1-13")).toBe(false);
  });

  it("B4/B5 交界处的名称与原图编号一致", () => {
    const b4 = w1.find((booth) => {
      return booth.code === "B4";
    });
    const b5 = w1.find((booth) => {
      return booth.code === "B5";
    });

    expect(
      b4?.entries.find((entry) => {
        return entry.slot === "15";
      })?.names[0],
    ).toBe("QBOOM萌核邦");
    expect(
      b5?.entries.find((entry) => {
        return entry.slot === "01";
      })?.names[0],
    ).toBe("RadioRat电台老鼠");
    expect(
      b5?.entries.find((entry) => {
        return entry.slot === "02";
      })?.names[0],
    ).toBe("Sensation Studio");
    expect(
      b5?.entries.find((entry) => {
        return entry.slot === "17";
      })?.names[0],
    ).toBe("CC小窝");
    expect(sourceRowCrops.has("W1-B5-01")).toBe(true);
  });

  it("619 条已确认且一条看不清，校对基线与源码一致", () => {
    const currentNames = new Map<string, string>(
      w1.flatMap((booth) => {
        return booth.entries.map((entry) => {
          return [`W1-${booth.code}-${entry.slot}`, entry.names[0] ?? ""] as const;
        });
      }),
    );

    expect(Object.keys(reviewedDecisions)).toHaveLength(620);
    const confirmed = Object.values(reviewedDecisions).filter((decision) => {
      return decision.status === "confirmed";
    });

    expect(confirmed).toHaveLength(619);
    expect(
      confirmed.every((decision) => {
        return decision.value.length > 0;
      }),
    ).toBe(true);
    expect(reviewedDecisions["W1-B4-03"]).toMatchObject({ status: "unclear", value: "" });
    for (const [id, decision] of Object.entries(reviewedDecisions)) {
      expect(sourceRowCrops.has(id)).toBe(true);
      expect(decision.value).toBe(currentNames.get(id));
    }
  });
});
