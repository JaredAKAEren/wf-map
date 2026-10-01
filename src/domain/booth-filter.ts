import type { Booth, Hall } from "../data/exhibition";
import { searchBooths, type BoothSearchResult } from "./map";

export interface BoothFilters {
  photos: boolean;
  favorites: boolean;
}

export function filterBooths(
  query: string,
  booths: Booth[],
  filters: BoothFilters,
  photoIds: ReadonlySet<string>,
  favoriteIds: ReadonlySet<string>,
  preferredHall?: Hall,
): BoothSearchResult[] {
  const candidates = booths.filter((booth) => {
    return (
      (!filters.photos || photoIds.has(booth.id)) &&
      (!filters.favorites || favoriteIds.has(booth.id))
    );
  });
  if (query.trim()) {
    return searchBooths(query, candidates, preferredHall);
  }
  if (!filters.photos && !filters.favorites) {
    return [];
  }

  candidates.sort((left, right) => {
    return (
      Number(right.hall === preferredHall) - Number(left.hall === preferredHall) ||
      left.hall.localeCompare(right.hall) ||
      left.code.localeCompare(right.code, "en", { numeric: true })
    );
  });

  return candidates.map((booth) => {
    return { booth };
  });
}
