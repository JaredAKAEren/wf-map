import { describe, expect, it } from "vite-plus/test";

import { booths, halls, type Booth, type BoothEntry, type Hall } from "../data/exhibition";
import { searchBooths } from "./map";

const entry = (
  names: string[],
  options: { slot?: string; searchTerms?: string[] } = {},
): BoothEntry => {
  return {
    slot: options.slot,
    names,
    searchTerms: options.searchTerms ?? [],
  };
};

const booth = (id: string, hall: Hall, code: string, entries: BoothEntry[]): Booth => {
  return { id, hall, code, entries, x: 0, y: 0, width: 10, height: 10 };
};

describe("展位查找与位置", () => {
  it("名称漏字仍找到目标，完全无关输入不移动到任意展位", () => {
    const entries = [booth("target", "W5", "A28", [entry(["AmiAmi"])])];

    expect(searchBooths("amimi", entries)[0]?.booth.id).toBe("target");
    expect(searchBooths("xyz987xyz", entries)).toEqual([]);
  });

  it("同一展位的多个展示名称和隐藏别名均能找到", () => {
    const entries = [
      booth("brands", "W5", "A25", [
        entry(["KURO GAMES", "HanaB"], { searchTerms: ["ku luo you xi", "klyx"] }),
      ]),
    ];

    expect(searchBooths("KURO GAMES", entries)[0]?.booth.id).toBe("brands");
    expect(searchBooths("HanaB", entries)[0]?.booth.id).toBe("brands");
    expect(searchBooths("klyx", entries)[0]?.booth.id).toBe("brands");
  });

  it("支持中文单字、全拼、拼音首字母和独立英文名容错", () => {
    const entries = [
      booth("kaiyodo", "W5", "A37", [
        entry(["海洋堂KAIYODO"], { searchTerms: ["KAIYODO", "hai yang tang", "hyt"] }),
      ]),
      booth("sushing", "W5", "A48", [entry(["溯行SuShing"], { searchTerms: ["SuShing"] })]),
    ];

    expect(searchBooths("海", entries)[0]?.booth.id).toBe("kaiyodo");
    expect(searchBooths("haiyangtang", entries)[0]?.booth.id).toBe("kaiyodo");
    expect(searchBooths("hai yang tang", entries)[0]?.booth.id).toBe("kaiyodo");
    expect(searchBooths("hyt", entries)[0]?.booth.id).toBe("kaiyodo");
    expect(searchBooths("sushng", entries)[0]?.booth.id).toBe("sushing");
    expect(searchBooths("h", entries)).toEqual([]);
  });

  it("忽略名称和输入中的标点与符号", () => {
    const entries = [booth("symbols", "W1", "A01", [entry(["Q·B/OOM萌核邦"])])];

    expect(searchBooths("qboom萌核邦", entries)[0]?.booth.id).toBe("symbols");
    expect(searchBooths("Q·B/OOM萌核邦", entries)[0]?.booth.id).toBe("symbols");
    expect(searchBooths("#!", entries)).toEqual([]);
  });

  it("纯数字精确匹配编号并保留较低优先级的品牌结果", () => {
    const entries = [
      booth("w1-a52", "W1", "A52", [entry(["W1 Booth"])]),
      booth("w5-a52", "W5", "A52", [entry(["W5 Booth"])]),
      booth("brand", "W5", "A01", [entry(["52TOYS"])]),
    ];

    expect(
      searchBooths("52", entries, "W5").map((result) => {
        return result.booth.id;
      }),
    ).toEqual(["w5-a52", "w1-a52", "brand"]);
  });

  it("准确匹配优先于包含，同名结果优先当前查看馆，且不修改输入顺序", () => {
    const entries = [
      booth("one", "W1", "A01", [entry(["Test Brand"])]),
      booth("two", "W2", "A02", [entry(["Test Brand"])]),
      booth("three", "W2", "A03", [entry(["Test Brand Extra"])]),
    ];
    Object.freeze(entries);

    expect(
      searchBooths("Test Brand", entries, "W2").map((result) => {
        return result.booth.id;
      }),
    ).toEqual(["two", "one", "three"]);
  });

  it("个人展商按条返回，区域编号仍只返回地图区域", () => {
    const personal = booth("wf2026/W2/M1", "W2", "M1", [
      entry(["回到未来"], { slot: "01" }),
      entry([], { slot: "02" }),
      entry(["馒馒堂"], { slot: "03" }),
    ]);

    const nameResult = searchBooths("回到未来", [personal]);
    expect(nameResult).toHaveLength(1);
    expect(nameResult[0]?.booth.id).toBe(personal.id);
    expect(nameResult[0]?.entry?.slot).toBe("01");

    const codeResult = searchBooths("W2M1", [personal]);
    expect(codeResult).toEqual([{ booth: personal, entry: undefined }]);
    expect(searchBooths("02", [personal])).toEqual([]);
  });

  it("同一区域内多个展商命中时分别返回", () => {
    const personal = booth("wf2026/W2/M1", "W2", "M1", [
      entry(["甲工作室"], { slot: "01" }),
      entry(["乙工作室"], { slot: "02" }),
    ]);

    expect(
      searchBooths("工作室", [personal]).map((result) => {
        return result.entry?.slot;
      }),
    ).toEqual(["01", "02"]);
  });

  it("保留既有 W5 名称、拼音和区域编号搜索", () => {
    expect(searchBooths("KURO GAMES", booths)[0]?.booth.id).toBe("wf2026/W5/A25");
    expect(searchBooths("haiyangtang", booths)[0]?.booth.id).toBe("wf2026/W5/A37");
    expect(searchBooths("W5A28", booths)[0]).toEqual({
      booth: booths.find((item) => {
        return item.id === "wf2026/W5/A28";
      }),
      entry: undefined,
    });
  });

  it("支持 W4 展商的英文别名、全拼和拼音首字母搜索", () => {
    expect(searchBooths("HAVOC", booths, "W4")[0]?.booth.id).toBe("wf2026/W4/A01");
    expect(searchBooths("haxzw", booths, "W4")[0]?.booth.id).toBe("wf2026/W4/A01");
    expect(searchBooths("coreplay", booths, "W4")[0]?.booth.id).toBe("wf2026/W4/A13");
    expect(searchBooths("plzgydzx", booths, "W4")[0]?.booth.id).toBe("wf2026/W4/A31");
  });

  it("W1、W2 的汉字拼音、首字母与日文假名罗马音能定位到原展商", () => {
    const cases = [
      ["yuanxingqidong", "wf2026/W1/H6", "01"],
      ["yxqd", "wf2026/W1/H6", "01"],
      ["qmjm", "wf2026/W2/A01", undefined],
      ["shaonvmiaomiaowu", "wf2026/W2/K3", "06"],
      ["zhushihuishejueduiseyudezainyanjiusuo", "wf2026/W1/H3", "02"],
    ] as const;

    for (const [query, boothId, slot] of cases) {
      expect(
        searchBooths(query, booths).some((result) => {
          return result.booth.id === boothId && result.entry?.slot === slot;
        }),
      ).toBe(true);
    }
  });
});

describe("展位数据约束", () => {
  it("W1、W2 含汉字或假名的记录有隐藏检索词，看不清的记录保持空白", () => {
    const localizedEntries = booths
      .filter((item) => {
        return item.hall === "W1" || item.hall === "W2";
      })
      .flatMap((item) => {
        return item.entries.filter((itemEntry) => {
          return itemEntry.names.some((name) => {
            return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(name);
          });
        });
      });
    const unclear = booths
      .find((item) => {
        return item.id === "wf2026/W1/B4";
      })
      ?.entries.find((itemEntry) => {
        return itemEntry.slot === "03";
      });

    expect(localizedEntries.length).toBeGreaterThan(600);
    expect(
      localizedEntries.every((itemEntry) => {
        return itemEntry.searchTerms.length > 0;
      }),
    ).toBe(true);
    expect(unclear?.names).toEqual([]);
    expect(unclear?.searchTerms).toEqual([]);
  });

  it("展馆按现场从左到右排列", () => {
    expect(halls).toEqual(["W5", "W4", "W3", "W2", "W1"]);
  });

  it("区域 ID 和馆内编号唯一，个人编号合法且区域内唯一", () => {
    const ids = booths.map((item) => {
      return item.id;
    });
    const hallCodes = booths.map((item) => {
      return `${item.hall}/${item.code}`;
    });

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(hallCodes).size).toBe(hallCodes.length);

    for (const item of booths) {
      const slots = item.entries.flatMap((itemEntry) => {
        return itemEntry.slot ? [itemEntry.slot] : [];
      });

      expect(
        slots.every((slot) => {
          return /^\d{2}$/u.test(slot);
        }),
      ).toBe(true);
      expect(new Set(slots).size).toBe(slots.length);
      expect(
        item.entries.every((itemEntry) => {
          return itemEntry.names.every((name) => {
            return !/^\d{2}-$/u.test(name);
          });
        }),
      ).toBe(true);
    }
  });

  it("保留各馆区域数量和代表性稳定 ID", () => {
    const counts = booths.reduce<Record<string, number>>((result, item) => {
      result[item.hall] = (result[item.hall] ?? 0) + 1;

      return result;
    }, {});

    expect(counts).toEqual({ W1: 58, W2: 78, W3: 39, W4: 38, W5: 39 });
    expect(
      booths.some((item) => {
        return item.id === "wf2026/W2/M1";
      }),
    ).toBe(true);
    expect(
      booths.some((item) => {
        return item.id === "wf2026/W5/A13";
      }),
    ).toBe(true);
  });
});
