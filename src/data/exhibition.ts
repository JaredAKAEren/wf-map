import type { Booth, BoothConfig, Hall } from "./exhibition/types";
import { halls } from "./exhibition/types";
import { w1 } from "./exhibition/w1";
import { w2 } from "./exhibition/w2";
import { w3 } from "./exhibition/w3";
import { w4 } from "./exhibition/w4";
import { w5 } from "./exhibition/w5";

export { halls };
export { isHall } from "./exhibition/types";
export type { Booth, BoothEntry, Hall } from "./exhibition/types";

export const imageSize = { width: 800, height: 1500 };

const hallBooths: Record<Hall, BoothConfig[]> = {
  W1: w1,
  W2: w2,
  W3: w3,
  W4: w4,
  W5: w5,
};

export const booths: Booth[] = halls.flatMap((hall) => {
  return hallBooths[hall].map(({ code, entries, x, y, width, height }) => {
    return {
      id: `wf2026/${hall}/${code}`,
      hall,
      code,
      entries,
      x,
      y,
      width,
      height,
    };
  });
});
