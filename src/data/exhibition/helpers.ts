import type { BoothEntry } from "./types";

export function enterpriseEntries(names: string[], searchTerms: string[] = []): BoothEntry[] {
  return [{ names, searchTerms }];
}

/**
 * 个人展商直接维护在所属主分区的 entries 中。数组必须严格按展商图的编号顺序排列，不能多录或漏录；无法辨认的名称用空字符串占位，编号由 index 自动拼接。仅当原图编号不是从 01 开始时传入 startSlot。
 */
export function personalEntries(names: string[], startSlot = 1): BoothEntry[] {
  return names.map((name, index) => {
    return {
      slot: String(index + startSlot).padStart(2, "0"),
      names: name ? [name] : [],
      searchTerms: [],
    };
  });
}
