import { Preferences } from "@capacitor/preferences";
import { onMounted, onUnmounted, ref, shallowRef } from "vue";

import { booths } from "../data/exhibition";
import { onPhotosChanged, photos } from "../services/photos";

const favoritesKey = "wf-map/favorites-v1";
const knownIds = new Set(
  booths.map((booth) => {
    return booth.id;
  }),
);

export function useBoothMarks(report: (message: string) => void) {
  const favoriteIds = shallowRef<ReadonlySet<string>>(new Set());
  const photoIds = shallowRef<ReadonlySet<string>>(new Set());
  const favoritesReady = ref(false);
  const favoriteSaving = ref(false);
  const photosReady = ref(false);
  let photoRequest = 0;
  let active = true;

  async function refreshPhotos() {
    const token = ++photoRequest;
    try {
      const result = await photos.listBooths();
      if (active && token === photoRequest) {
        photoIds.value = new Set(
          result.boothIds.filter((id) => {
            return knownIds.has(id);
          }),
        );
        photosReady.value = true;
      }
    } catch {
      if (active && token === photoRequest) {
        report("贴图记录读取失败，可重新打开应用重试。");
      }
    }
  }

  async function toggleFavorite(id: string) {
    if (!favoritesReady.value || favoriteSaving.value || !knownIds.has(id)) {
      return;
    }

    const next = new Set(favoriteIds.value);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }

    favoriteSaving.value = true;
    try {
      await Preferences.set({ key: favoritesKey, value: JSON.stringify([...next]) });
      if (active) {
        favoriteIds.value = next;
      }
    } catch {
      if (active) {
        report("收藏保存失败，请重试。");
      }
    } finally {
      favoriteSaving.value = false;
    }
  }

  const unsubscribe = onPhotosChanged(() => {
    void refreshPhotos();
  });

  onMounted(async () => {
    void refreshPhotos();
    try {
      const saved = await Preferences.get({ key: favoritesKey });
      const ids: unknown = saved.value ? JSON.parse(saved.value) : [];
      if (!Array.isArray(ids)) {
        throw new TypeError("收藏记录格式错误");
      }

      if (active) {
        favoriteIds.value = new Set(
          ids.filter((id): id is string => {
            return typeof id === "string" && knownIds.has(id);
          }),
        );
        favoritesReady.value = true;
      }
    } catch {
      if (active) {
        report("收藏记录无法读取，可重新打开应用重试。");
      }
    }
  });

  onUnmounted(() => {
    active = false;
    photoRequest++;
    unsubscribe();
  });

  return { favoriteIds, photoIds, favoritesReady, favoriteSaving, photosReady, toggleFavorite };
}
