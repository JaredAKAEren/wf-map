import type { Booth, BoothEntry, Hall } from "../data/exhibition";

export interface BoothSearchResult {
  booth: Booth;
  entry?: BoothEntry;
}

interface ScoredBoothSearchResult extends BoothSearchResult {
  score: number;
  entryIndex: number;
}

const normalize = (value: string) => {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\-_]/gu, "");
};

const boothNumber = (value: string) => {
  const digits = value.match(/\d+$/u)?.[0];

  return digits?.replace(/^0+(?=\d)/u, "");
};

const isSingleHan = (value: string) => {
  return Array.from(value).length === 1 && /^\p{Script=Han}$/u.test(value);
};

function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => {
    return i;
  });

  for (let i = 0; i < a.length; i++) {
    const row = [i + 1];
    for (let j = 0; j < b.length; j++) {
      row.push(Math.min(row[j]! + 1, previous[j + 1]! + 1, previous[j]! + (a[i] === b[j] ? 0 : 1)));
    }
    previous = row;
  }

  return previous[b.length]!;
}

function scoreTerm(query: string, raw: string): number {
  const term = normalize(raw);
  if (term === query) {
    return 100;
  }

  const partialAllowed = query.length >= 2 || isSingleHan(query);
  if (partialAllowed && term.startsWith(query)) {
    return 90;
  }
  if (partialAllowed && term.includes(query)) {
    return 85;
  }
  if (query.length >= 4 && Math.abs(query.length - term.length) <= 2) {
    const edits = distance(query, term);
    if (edits <= Math.max(1, Math.floor(query.length * 0.25))) {
      return 70 - edits * 5;
    }
  }

  return 0;
}

export function searchBooths(
  query: string,
  booths: Booth[],
  preferredHall?: Hall,
): BoothSearchResult[] {
  const q = normalize(query);
  if (!q) {
    return [];
  }

  const codeQuery = /^(?:w[1-5])?[a-z]\d+$/u.test(q);
  const numericQuery = /^\d+$/u.test(q) ? boothNumber(q) : undefined;

  const matches: ScoredBoothSearchResult[] = booths.flatMap((booth) => {
    const code = normalize(booth.code);
    let boothScore = q === code || q === normalize(booth.hall + booth.code) ? 110 : 0;

    if (numericQuery !== undefined && boothNumber(code) === numericQuery) {
      boothScore = Math.max(boothScore, 105);
    }

    if (boothScore > 0) {
      return [{ booth, score: boothScore, entryIndex: -1 }];
    }
    if (codeQuery) {
      return [];
    }

    return booth.entries.flatMap((entry, entryIndex) => {
      let score = 0;

      for (const term of [...entry.names, ...entry.searchTerms]) {
        score = Math.max(score, scoreTerm(q, term));
      }
      if (!score) {
        return [];
      }

      return [{ booth, entry, score, entryIndex }];
    });
  });

  matches.sort((a, b) => {
    return (
      b.score - a.score ||
      Number(b.booth.hall === preferredHall) - Number(a.booth.hall === preferredHall) ||
      a.booth.id.localeCompare(b.booth.id) ||
      a.entryIndex - b.entryIndex
    );
  });

  return matches.map(({ booth, entry }) => {
    return { booth, entry };
  });
}
