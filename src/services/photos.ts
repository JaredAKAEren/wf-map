import { Capacitor, registerPlugin } from "@capacitor/core";

export interface Photo {
  uri: string;
  boothId: string;
  createdAt: number;
}
interface PhotoPlugin {
  pick(): Promise<{ uris: string[]; failed: number }>;
  list(options: { boothId: string }): Promise<{ photos: Photo[] }>;
  assign(options: {
    uri: string;
    boothId: string;
    replace: boolean;
  }): Promise<{ conflict?: string }>;
  thumbnail(options: { uri: string }): Promise<{ dataUrl: string }>;
  open(options: { uri: string }): Promise<void>;
  remove(options: { uri: string }): Promise<void>;
  releaseUnlinked(options: { uris: string[] }): Promise<void>;
}

export const nativePhotos = Capacitor.getPlatform() === "android";
export const photos = registerPlugin<PhotoPlugin>("ExhibitionPhotos");
