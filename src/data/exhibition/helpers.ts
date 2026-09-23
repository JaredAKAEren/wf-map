import type { BoothEntry } from "./types";

export function enterpriseEntries(names: string[], searchTerms: string[] = []): BoothEntry[] {
  return [{ names, searchTerms }];
}

/**
 * 个人展商直接维护在所属主分区的 entries 中。数组必须严格按展商图的编号顺序排列，不能多录或漏录；无法辨认的名称用空字符串占位，编号由 index 自动拼接。需要检索词时在原数组项中使用 [名称, 检索词]，不另建编号映射。仅当原图编号不是从 01 开始时传入 startSlot。
 */
type PersonalEntryInput = string | [name: string, searchTerms: string[]];

export function personalEntries(names: PersonalEntryInput[], startSlot = 1): BoothEntry[] {
  return names.map((input, index) => {
    const name = typeof input === "string" ? input : input[0];
    const searchTerms = typeof input === "string" ? [] : input[1];

    return {
      slot: String(index + startSlot).padStart(2, "0"),
      names: name ? [name] : [],
      searchTerms,
    };
  });
}
