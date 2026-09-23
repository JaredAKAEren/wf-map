export interface CropRect {
  source: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ReviewColumn {
  bottom: number;
  label: string;
  rows: { id: string; y: number; height: number }[];
  source: number;
  width: number;
  x: number;
  y: number;
}

export interface ReviewSource {
  label: string;
  localUrl: string;
}

interface SourceSegment {
  code?: string;
  from?: number;
  section?: string;
  to?: number;
}

interface SourceColumn {
  bottom: number;
  segments: SourceSegment[];
  source: number;
  x: number;
  width: number;
  y: number;
}

export interface ConflictEvidence {
  official: string;
}

export const reviewSources: ReviewSource[] = [
  { label: "原图 1（A、B 区起始）", localUrl: "/.local/exhibitor-review/w1-1.png" },
  { label: "原图 2（B、C、D 区）", localUrl: "/.local/exhibitor-review/w1-2.png" },
  { label: "原图 3（D、E、F、G 区）", localUrl: "/.local/exhibitor-review/w1-3.png" },
  { label: "原图 4（G、H 区）", localUrl: "/.local/exhibitor-review/w1-4.png" },
];

const sourceColumns: SourceColumn[] = [
  {
    source: 0,
    x: 388,
    y: 43,
    width: 162,
    bottom: 930,
    segments: [
      { section: "A" },
      { code: "A1", from: 1, to: 15 },
      { code: "A2", from: 1, to: 11 },
      { code: "A3", from: 1, to: 5 },
      { code: "A4", from: 1, to: 15 },
      { code: "A5", from: 1, to: 4 },
    ],
  },
  {
    source: 0,
    x: 560,
    y: 43,
    width: 174,
    bottom: 930,
    segments: [
      { code: "A5", from: 5, to: 16 },
      { code: "A6", from: 1, to: 9 },
      { code: "A7", from: 1, to: 10 },
      { section: "B" },
      { code: "B1", from: 1, to: 13 },
      { code: "B2", from: 1, to: 5 },
    ],
  },
  {
    source: 1,
    x: 43,
    y: 43,
    width: 166,
    bottom: 930,
    segments: [
      { code: "B2", from: 6, to: 6 },
      { code: "B3", from: 1, to: 9 },
      { code: "B4", from: 1, to: 15 },
      { code: "B5", from: 1, to: 17 },
      { code: "B6", from: 1, to: 8 },
    ],
  },
  {
    source: 1,
    x: 215,
    y: 43,
    width: 166,
    bottom: 930,
    segments: [
      { code: "B6", from: 9, to: 16 },
      { code: "B7", from: 1, to: 6 },
      { section: "C" },
      { code: "C1", from: 1, to: 11 },
      { code: "C2", from: 1, to: 13 },
      { code: "C3", from: 1, to: 9 },
      { code: "C4", from: 1, to: 2 },
    ],
  },
  {
    source: 1,
    x: 388,
    y: 43,
    width: 166,
    bottom: 930,
    segments: [
      { code: "C4", from: 3, to: 15 },
      { code: "C5", from: 1, to: 13 },
      { code: "C6", from: 1, to: 12 },
      { code: "C7", from: 1, to: 12 },
    ],
  },
  {
    source: 1,
    x: 560,
    y: 43,
    width: 174,
    bottom: 930,
    segments: [
      { section: "D" },
      { code: "D1", from: 1, to: 11 },
      { code: "D2", from: 1, to: 12 },
      { code: "D3", from: 1, to: 9 },
      { code: "D4", from: 1, to: 11 },
      { code: "D5", from: 1, to: 7 },
    ],
  },
  {
    source: 2,
    x: 43,
    y: 43,
    width: 166,
    bottom: 930,
    segments: [
      { code: "D6", from: 1, to: 15 },
      { code: "D7", from: 1, to: 6 },
      { code: "D8", from: 1, to: 10 },
      { section: "E" },
      { code: "E1", from: 1, to: 10 },
      { code: "E2", from: 1, to: 7 },
      { code: "E3", from: 1, to: 1 },
    ],
  },
  {
    source: 2,
    x: 215,
    y: 43,
    width: 166,
    bottom: 930,
    segments: [
      { code: "E3", from: 2, to: 8 },
      { code: "E4", from: 1, to: 14 },
      { code: "E5", from: 1, to: 12 },
      { code: "E6", from: 1, to: 12 },
      { code: "E7", from: 1, to: 4 },
      { code: "E8", from: 1, to: 2 },
    ],
  },
  {
    source: 2,
    x: 388,
    y: 43,
    width: 166,
    bottom: 930,
    segments: [
      { code: "E8", from: 3, to: 13 },
      { section: "F" },
      { code: "F1", from: 1, to: 9 },
      { code: "F2", from: 1, to: 8 },
      { code: "F3", from: 1, to: 11 },
      { code: "F4", from: 1, to: 8 },
      { code: "F5", from: 1, to: 3 },
    ],
  },
  {
    source: 2,
    x: 560,
    y: 43,
    width: 174,
    bottom: 930,
    segments: [
      { code: "F5", from: 4, to: 9 },
      { code: "F6", from: 1, to: 12 },
      { code: "F7", from: 1, to: 6 },
      { section: "G" },
      { code: "G1", from: 1, to: 10 },
      { code: "G2", from: 1, to: 8 },
      { code: "G3", from: 1, to: 7 },
    ],
  },
  {
    source: 3,
    x: 43,
    y: 43,
    width: 166,
    bottom: 946,
    segments: [
      { code: "G3", from: 8, to: 10 },
      { code: "G4", from: 1, to: 12 },
      { code: "G5", from: 1, to: 14 },
      { code: "G6", from: 1, to: 12 },
      { code: "G7", from: 1, to: 9 },
    ],
  },
  {
    source: 3,
    x: 215,
    y: 43,
    width: 166,
    bottom: 946,
    segments: [
      { code: "G7", from: 10, to: 11 },
      { section: "H" },
      { code: "H1", from: 1, to: 12 },
      { code: "H2", from: 1, to: 13 },
      { code: "H3", from: 1, to: 11 },
      { code: "H4", from: 1, to: 7 },
      { code: "H5", from: 1, to: 3 },
    ],
  },
  {
    source: 3,
    x: 388,
    y: 43,
    width: 166,
    bottom: 478,
    segments: [
      { code: "H5", from: 4, to: 10 },
      { code: "H6", from: 1, to: 10 },
      { code: "H7", from: 1, to: 8 },
    ],
  },
];

export const conflictEvidence: Record<string, ConflictEvidence> = {
  "W1-A1-06": { official: "NightTalker摸鱼基地" },
  "W1-A4-06": { official: "27狱" },
  "W1-A6-02": { official: "迷因工作室" },
  "W1-A6-06": { official: "黄昏熔融DUSKMELT" },
  "W1-B5-10": { official: "空想造物" },
  "W1-C1-01": { official: "黑匣工作室" },
  "W1-C1-02": { official: "沧溟工作室" },
  "W1-C7-02": { official: "Firowito" },
  "W1-D1-01": { official: "MOJING TOYS 模镜工作室" },
  "W1-D2-01": { official: "布叽岛" },
  "W1-D2-12": { official: "幻星重工" },
  "W1-D3-02": { official: "造物志&zoe手作" },
  "W1-D3-03": { official: "长脚犀studio" },
  "W1-D3-05": { official: "stedi司特力" },
  "W1-D4-02": { official: "炽星工作室 Blazing Galaxy Studio" },
  "W1-D4-03": { official: "钢铁浪漫制造所" },
  "W1-D4-09": { official: "阿古研究所" },
  "W1-D4-10": { official: "黑匣工作室" },
  "W1-D7-05": { official: "一川艺术" },
  "W1-D8-03": { official: "海怪游戏营地" },
  "W1-D8-09": { official: "双氧水" },
  "W1-D8-10": { official: "溯源工作室" },
  "W1-E1-03": { official: "须弥工作室" },
  "W1-E1-08": { official: "吾造WUZAO" },
  "W1-E1-09": { official: "小虫趣玩" },
  "W1-E3-03": { official: "模型捞捞FIGURERICH" },
  "W1-E3-05": { official: "集奇怪—世界昆虫" },
  "W1-E5-03": { official: "JC家の玩具铺子" },
  "W1-E6-02": { official: "TinyFox小小狐" },
  "W1-E7-04": { official: "无限模境OTAKU ZONE" },
  "W1-E8-03": { official: "碓冰拓海手作" },
  "W1-E8-07": { official: "鲨鲨豆的毛茸动物世界" },
  "W1-E8-08": { official: "黑白灰小狗" },
  "W1-E8-11": { official: "kozoostudio" },
  "W1-F2-02": { official: "袁星亮原型工作室" },
  "W1-F3-03": { official: "幽兔模玩" },
  "W1-F3-09": { official: "1000Tentacles" },
  "W1-F4-01": { official: "周峰山人" },
  "W1-F4-08": { official: "魔偶工坊" },
  "W1-F5-03": { official: "怪兽的沙盒" },
  "W1-G1-08": { official: "武装姬修站" },
  "W1-G3-05": { official: "燥物工作室" },
  "W1-H1-01": { official: "小浚工作室" },
  "W1-H1-07": { official: "捕人夹" },
  "W1-H1-11": { official: "黑匣工作室" },
  "W1-H2-12": { official: "黑炎工房" },
  "W1-H4-03": { official: "梵境文创FancyRealm" },
  "W1-H4-04": { official: "君卿工作室" },
  "W1-H6-03": { official: "安以佑的涂装小铺" },
  "W1-H6-09": { official: "啤库尼库工房" },
  "W1-H7-04": { official: "iDUOi Studio" },
};

function sourceId(code: string, slot: number) {
  return `W1-${code}-${String(slot).padStart(2, "0")}`;
}

function sourceRows() {
  const rows = new Map<string, CropRect>();
  const columns: ReviewColumn[] = [];

  for (const [index, column] of sourceColumns.entries()) {
    const columnRows: ReviewColumn["rows"] = [];
    const unitCount = column.segments.reduce((count, segment) => {
      if (segment.section) {
        return count + 1;
      }

      return count + (segment.to! - segment.from! + 1);
    }, 0);
    const unitHeight = (column.bottom - column.y) / unitCount;
    let unit = 0;

    for (const segment of column.segments) {
      if (segment.section) {
        unit += 1;
        continue;
      }
      for (let slot = segment.from!; slot <= segment.to!; slot += 1) {
        const y = column.y + unit * unitHeight;
        const id = sourceId(segment.code!, slot);
        rows.set(id, {
          source: column.source,
          x: column.x,
          y: Math.max(0, Math.floor(y - 7)),
          width: column.width,
          height: Math.ceil(unitHeight + 14),
        });
        columnRows.push({ id, y, height: unitHeight });
        unit += 1;
      }
    }
    columns.push({
      bottom: column.bottom,
      label: `原图 ${column.source + 1} · 第 ${index + 1} 列`,
      rows: columnRows,
      source: column.source,
      width: column.width,
      x: column.x,
      y: column.y,
    });
  }

  return { rows, columns };
}

const reviewLayout = sourceRows();

export const sourceRowCrops = reviewLayout.rows;
export const reviewColumns = reviewLayout.columns;
