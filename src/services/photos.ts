import { Capacitor, registerPlugin } from "@capacitor/core";

import { webPhotos } from "./web-photos";

export interface Photo {
  uri: string;
  boothId: string;
  createdAt: number;
}
export interface PhotoService {
  pick(): Promise<{ uris: string[]; failed: number }>;
  stageFiles(files: readonly File[]): Promise<{ uris: string[]; failed: number }>;
  list(options: { boothId: string }): Promise<{ photos: Photo[] }>;
  assign(options: {
    uri: string;
    boothId: string;
    replace: boolean;
  }): Promise<{ conflict?: string }>;
  thumbnail(options: { uri: string }): Promise<{ dataUrl: string }>;
  open(options: { uri: string }): Promise<void>;
  original(options: { uri: string }): Promise<Blob>;
  remove(options: { uri: string }): Promise<void>;
  releaseUnlinked(options: { uris: string[] }): Promise<void>;
}

export const nativePhotos = Capacitor.getPlatform() === "android";
const nativePlugin = registerPlugin<PhotoService>("ExhibitionPhotos");
export const photos: PhotoService = nativePhotos ? nativePlugin : webPhotos;
