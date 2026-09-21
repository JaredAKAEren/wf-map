export const halls = ["W1", "W2", "W3", "W4", "W5"] as const;

export type Hall = (typeof halls)[number];

export function isHall(value: unknown): value is Hall {
  return typeof value === "string" && (halls as readonly string[]).includes(value);
}

export interface Booth {
  id: string;
  hall: Hall;
  code: string;
  entries: BoothEntry[];
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoothEntry {
  slot?: string;
  names: string[];
  searchTerms: string[];
}

export interface BoothBounds {
  code: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoothConfig extends BoothBounds {
  entries: BoothEntry[];
}
