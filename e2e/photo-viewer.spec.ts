import { expect, test, type Locator, type Page } from "@playwright/test";

declare global {
  interface Window {
    photoViewerHarness: { created: string[]; revoked: string[]; failOriginal: boolean };
  }
}

async function prepare(page: Page, count = 3) {
  await page.goto("/");
  await page.getByRole("button", { name: "搜索展商或展位", exact: true }).click();
  await page.getByRole("combobox").fill("A34");
  await page.getByRole("option", { name: /A34/ }).first().click();
  await page.getByRole("button", { name: "展开贴图" }).click();
  await page.locator('input[type="file"]').setInputFiles(
    Array.from({ length: count }, (_, index) => {
      const width = index === 1 ? 1800 : 1200;
      const height = index === 1 ? 900 : 1800;

      return {
        name: `viewer-${index}.svg`,
        mimeType: "image/svg+xml",
        buffer: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
            <rect width="100%" height="100%" fill="${["#ad542e", "#317a71", "#7265a0"][index]}"/>
            <circle cx="300" cy="400" r="160" fill="#fff0d9"/>
            <path d="M100 100H800V700H100Z" fill="none" stroke="white" stroke-width="20"/>
            <text x="200" y="1100" font-size="200" fill="white">${index + 1}</text>
          </svg>`,
        ),
      };
    }),
  );
  await expect(page.getByRole("button", { name: "查看原图", exact: true })).toHaveCount(count);
}

async function open(page: Page, index = 0) {
  await page.getByRole("button", { name: "查看原图", exact: true }).nth(index).click();
  await expect(page.getByRole("dialog", { name: "展位贴图原图" })).toBeVisible();
  await expect(activeImage(page)).toHaveClass(/image-ready/);
}

async function center(locator: Locator) {
  const box = (await locator.boundingBox())!;

  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function imageTransform(page: Page) {
  return activeImage(page).evaluate((element) => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform);

    return { scale: matrix.a, x: matrix.e, y: matrix.f };
  });
}

async function swipe(page: Page, dx: number, dy = 0, cancel = false) {
  const point = await center(page.locator(".viewer-stage"));
  const session = await page.context().newCDPSession(page);
  const start = { x: point.x - dx / 2, y: point.y - dy / 2, id: 1 };
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
  for (let step = 1; step <= 8; step += 1) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: start.x + (dx * step) / 8, y: start.y + (dy * step) / 8, id: 1 }],
    });
  }
  await session.send("Input.dispatchTouchEvent", {
    type: cancel ? "touchCancel" : "touchEnd",
    touchPoints: [],
  });
  await session.detach();
}

async function pinch(page: Page, from: number, to: number, liftOneFirst = false) {
  const point = await center(page.locator(".viewer-stage"));
  const session = await page.context().newCDPSession(page);

  const points = (distance: number) => {
    return [
      { x: point.x - distance / 2, y: point.y, id: 1 },
      { x: point.x + distance / 2, y: point.y, id: 2 },
    ];
  };

  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points(from) });
  for (let step = 1; step <= 10; step += 1) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: points(from + ((to - from) * step) / 10),
    });
  }
  if (liftOneFirst) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [points(to)[0]!],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: point.x - to / 2 + 12, y: point.y, id: 1 }],
    });
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await session.detach();
}

async function verticalDrag(page: Page, distances: number[], pause = 0, cancel = false) {
  const point = await center(page.locator(".viewer-stage"));
  const session = await page.context().newCDPSession(page);
  const start = { x: point.x, y: point.y - 100, id: 1 };
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
  for (const distance of distances) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...start, y: start.y + distance }],
    });
  }
  if (pause) {
    await page.waitForTimeout(pause);
  }
  await session.send("Input.dispatchTouchEvent", {
    type: cancel ? "touchCancel" : "touchEnd",
    touchPoints: [],
  });
  await session.detach();
}

async function dismissSettled(page: Page) {
  await expect(page.getByRole("dialog", { name: "展位贴图原图" })).toBeVisible();
  await expect
    .poll(() => {
      return page.locator(".viewer-track").evaluate((element) => {
        const matrix = new DOMMatrix(getComputedStyle(element).transform);

        return { scale: matrix.a, y: matrix.f };
      });
    })
    .toEqual({ scale: 1, y: 0 });
}

function activeSlide(page: Page) {
  return page.locator('.viewer-slide[data-active="true"]');
}

function activeImage(page: Page) {
  return activeSlide(page).locator(".viewer-image");
}

async function settled(page: Page, position: number) {
  await expect(activeImage(page)).toHaveAttribute("alt", `展位贴图原图 ${position}`);
  await expect(activeImage(page)).toHaveClass(/image-ready/);
  await expect
    .poll(async () => {
      return (await activeSlide(page).boundingBox())!.x;
    })
    .toBeCloseTo(0, 1);
}

test("全屏预览不显示按钮或说明，放大时单击保留预览，还原后单击退出", async ({ page }) => {
  await prepare(page);
  await open(page, 1);
  await settled(page, 2);
  const dialog = page.getByRole("dialog", { name: "展位贴图原图" });
  await expect(dialog.getByRole("button")).toHaveCount(0);
  await expect(dialog).toHaveText("");
  const box = (await page.locator(".viewer-stage").boundingBox())!;
  expect(box).toEqual({ x: 0, y: 0, ...page.viewportSize()! });
  expect(await activeImage(page).boundingBox()).toEqual(box);
  const point = await center(page.locator(".viewer-stage"));
  await page.mouse.dblclick(point.x, point.y, { delay: 60 });
  await expect
    .poll(async () => {
      return (await imageTransform(page)).scale;
    })
    .toBeCloseTo(2.5);

  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(350);
  await expect(dialog).toBeVisible();
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 100, point.y + 100, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () => {
      return (await imageTransform(page)).x;
    })
    .toBeGreaterThan(50);
  await settled(page, 2);

  await page.mouse.dblclick(point.x, point.y, { delay: 60 });
  await expect
    .poll(async () => {
      return (await imageTransform(page)).scale;
    })
    .toBe(1);
  await page.mouse.click(10, 10);
  await expect(dialog).toHaveCount(0);
  await open(page, 1);
  expect(await imageTransform(page)).toEqual({ scale: 1, x: 0, y: 0 });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "收起贴图" })).toBeVisible();
});

test("双指缩放只改变图片，退出后外层地图保持原样", async ({ page }) => {
  await prepare(page);
  const map = page.locator("svg.map");
  const view = await map.getAttribute("viewBox");
  const viewport = await page.evaluate(() => {
    return { scale: visualViewport!.scale, width: visualViewport!.width, scrollY };
  });
  await open(page);
  await pinch(page, 80, 240, true);
  await expect
    .poll(async () => {
      return (await imageTransform(page)).scale;
    })
    .toBeCloseTo(3, 1);
  await swipe(page, 160, 100);
  await settled(page, 1);
  await expect
    .poll(async () => {
      return (await imageTransform(page)).x;
    })
    .toBeGreaterThan(50);
  expect(
    await page.evaluate(() => {
      return { scale: visualViewport!.scale, width: visualViewport!.width, scrollY };
    }),
  ).toEqual(viewport);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "展位贴图原图" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "收起贴图" })).toBeVisible();
  await expect(map).toHaveAttribute("viewBox", view!);
  expect(
    await page.evaluate(() => {
      return { scale: visualViewport!.scale, width: visualViewport!.width, scrollY };
    }),
  ).toEqual(viewport);
  await open(page);
  expect(await imageTransform(page)).toEqual({ scale: 1, x: 0, y: 0 });
});

test("双点放大与单点退出可区分，放大时单点不退出，单张图片滑动回弹", async ({ page }) => {
  await prepare(page, 1);
  await open(page);
  const point = await center(page.locator(".viewer-stage"));
  await page.touchscreen.tap(point.x, point.y);
  await page.touchscreen.tap(point.x, point.y);
  await expect
    .poll(async () => {
      return (await imageTransform(page)).scale;
    })
    .toBeCloseTo(2.5);
  await page.touchscreen.tap(point.x, point.y);
  await page.waitForTimeout(350);
  await expect(page.getByRole("dialog", { name: "展位贴图原图" })).toBeVisible();
  await pinch(page, 240, 40);
  await expect
    .poll(() => {
      return imageTransform(page);
    })
    .toEqual({ scale: 1, x: 0, y: 0 });
  await swipe(page, -140);
  await settled(page, 1);
  await swipe(page, 140);
  await settled(page, 1);
  await page.touchscreen.tap(point.x, point.y);
  await expect(page.getByRole("dialog", { name: "展位贴图原图" })).toHaveCount(0);
});

test("轮播拖动时相邻图片跟手进入，松手有吸附中间帧并复用预载原图", async ({ page }) => {
  await prepare(page);
  await open(page);
  const neighbor = page.locator('.viewer-slide[data-active="false"]');
  await expect(neighbor.locator(".viewer-image")).toHaveClass(/image-ready/);
  const nextUrl = await neighbor.locator(".viewer-image").getAttribute("src");
  const point = await center(page.locator(".viewer-stage"));
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: point.x + 70, y: point.y, id: 1 }],
  });
  for (let distance = 20; distance <= 140; distance += 20) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: point.x + 70 - distance, y: point.y, id: 1 }],
    });
  }
  expect((await activeSlide(page).boundingBox())!.x).toBeCloseTo(-140, 1);
  expect((await neighbor.boundingBox())!.x).toBeLessThan(page.viewportSize()!.width);
  await expect(activeImage(page)).toHaveAttribute("alt", "展位贴图原图 1");
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const during = (await activeSlide(page).boundingBox())!.x;
  expect(during).toBeLessThanOrEqual(-140);
  expect(during).toBeGreaterThan(-page.viewportSize()!.width - 16);
  await settled(page, 2);
  expect(await activeImage(page).getAttribute("src")).toBe(nextUrl);
  expect(await imageTransform(page)).toEqual({ scale: 1, x: 0, y: 0 });
  await session.detach();
  await swipe(page, 140);
  await settled(page, 1);
});

test("首尾边界、短拖、上滑和取消手势回到原图，放大后拖动不切图", async ({ page }) => {
  await prepare(page);
  await open(page);
  await swipe(page, 140);
  await settled(page, 1);
  await swipe(page, -30);
  await settled(page, 1);
  await swipe(page, 0, -160);
  await dismissSettled(page);
  await settled(page, 1);
  await swipe(page, -140, 0, true);
  await settled(page, 1);
  await swipe(page, -140);
  await settled(page, 2);
  await pinch(page, 80, 240);
  await swipe(page, -140);
  await settled(page, 2);
  expect((await imageTransform(page)).scale).toBeCloseTo(3, 1);
  await page.keyboard.press("ArrowRight");
  await settled(page, 3);
  expect(await imageTransform(page)).toEqual({ scale: 1, x: 0, y: 0 });
  await swipe(page, -140);
  await settled(page, 3);
  await swipe(page, 140);
  await settled(page, 2);
});

test("滚轮缩放有上限，方向键切图复位，减少动态效果时轮播直接到位", async ({ page }) => {
  await prepare(page);
  await open(page);
  const point = await center(page.locator(".viewer-stage"));
  await page.mouse.move(point.x, point.y);
  for (let step = 0; step < 12; step += 1) {
    await page.mouse.wheel(0, -200);
  }
  await expect
    .poll(async () => {
      return (await imageTransform(page)).scale;
    })
    .toBe(6);
  await page.keyboard.press("ArrowLeft");
  expect((await imageTransform(page)).scale).toBe(6);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.keyboard.press("ArrowRight");
  await settled(page, 2);
  expect(await imageTransform(page)).toEqual({ scale: 1, x: 0, y: 0 });
  await page.mouse.dblclick(point.x, point.y, { delay: 60 });
  await expect
    .poll(async () => {
      return (await imageTransform(page)).scale;
    })
    .toBeCloseTo(2.5);
  await page.mouse.dblclick(point.x, point.y, { delay: 60 });
  await expect
    .poll(async () => {
      return (await imageTransform(page)).scale;
    })
    .toBe(1);
  await page.mouse.click(10, 10);
  await expect(page.getByRole("dialog", { name: "展位贴图原图" })).toHaveCount(0);
});

test("原图不可访问时仍可单点退出，关闭和移出预载范围会释放原图地址", async ({ page }) => {
  await page.addInitScript(() => {
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    const originalGet = Reflect.get(IDBObjectStore.prototype, "get");
    const created: string[] = [];
    const revoked: string[] = [];
    window.photoViewerHarness = { created, revoked, failOriginal: false };
    URL.createObjectURL = (blob) => {
      const url = create(blob);
      created.push(url);

      return url;
    };
    URL.revokeObjectURL = (url) => {
      revoked.push(url);
      revoke(url);
    };
    IDBObjectStore.prototype.get = function (key) {
      if (this.name === "photos" && window.photoViewerHarness.failOriginal) {
        throw new Error("模拟原图读取失败");
      }

      return Reflect.apply(originalGet, this, [key]);
    };
  });
  await prepare(page);
  await page.evaluate(() => {
    window.photoViewerHarness.failOriginal = true;
  });
  await page.getByRole("button", { name: "查看原图", exact: true }).first().click();
  await expect(activeSlide(page).locator(".viewer-unavailable")).toBeVisible();
  const dialog = page.getByRole("dialog", { name: "展位贴图原图" });
  await expect(dialog.getByRole("button")).toHaveCount(0);
  await expect(dialog).toHaveText("");
  await page.touchscreen.tap(10, 10);
  await expect(dialog).toHaveCount(0);
  await page.evaluate(() => {
    window.photoViewerHarness.failOriginal = false;
  });
  await open(page);
  const firstUrl = await activeImage(page).getAttribute("src");
  await page.keyboard.press("ArrowRight");
  await settled(page, 2);
  await page.keyboard.press("ArrowRight");
  await settled(page, 3);
  expect(
    await page.evaluate((url) => {
      return window.photoViewerHarness.revoked.includes(url!);
    }, firstUrl),
  ).toBe(true);
  await verticalDrag(page, [30, 80, 160, 200]);
  await expect(dialog).toHaveCount(0);
  expect(
    await page.evaluate(() => {
      const urls = window.photoViewerHarness;

      return urls.created.filter((url) => {
        return !urls.revoked.includes(url);
      });
    }),
  ).toEqual([]);
});

test("吸附动画可被下一次拖动接管，反向拖动回到原图后仍可继续切图", async ({ page }) => {
  await prepare(page);
  await open(page);
  const point = await center(page.locator(".viewer-stage"));
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x - 120, point.y, { steps: 6 });
  await page.mouse.up();
  await page.mouse.move(80, point.y);
  const stage = page.locator(".viewer-stage");
  await stage.evaluate((element) => {
    element.addEventListener(
      "pointerdown",
      () => {
        const slide = element.querySelector<HTMLElement>('.viewer-slide[data-active="true"]')!;
        element.setAttribute("data-capture-before", String(slide.getBoundingClientRect().x));
        requestAnimationFrame(() => {
          element.setAttribute("data-capture-after", String(slide.getBoundingClientRect().x));
        });
      },
      { capture: true, once: true },
    );
  });
  await page.mouse.down();
  await expect(stage).toHaveAttribute("data-capture-after");
  const before = Number(await stage.getAttribute("data-capture-before"));
  const captured = Number(await stage.getAttribute("data-capture-after"));
  expect(Math.abs(captured - before)).toBeLessThan(1);
  await page.mouse.move(360, point.y, { steps: 8 });
  await page.mouse.up();
  await settled(page, 1);
  await swipe(page, -140);
  await settled(page, 2);
});

test("下滑时图片跟手缩小、背景淡出，关闭后地图视野不变，重新打开复位", async ({ page }) => {
  await prepare(page);
  const map = page.locator("svg.map");
  const view = await map.getAttribute("viewBox");
  await open(page);
  const dialog = page.getByRole("dialog", { name: "展位贴图原图" });
  const point = await center(page.locator(".viewer-stage"));
  const session = await page.context().newCDPSession(page);
  const start = { x: point.x, y: point.y - 100, id: 1 };
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
  for (const distance of [30, 60, 90, 120, 180]) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...start, y: start.y + distance }],
    });
  }
  const frame = await page.locator(".viewer-track").evaluate((element) => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform);

    return { scale: matrix.a, y: matrix.f };
  });
  expect(frame.y).toBeCloseTo(180, 1);
  expect(frame.scale).toBeLessThan(1);
  expect(frame.scale).toBeGreaterThan(0.85);
  const opacity = await dialog.evaluate((element) => {
    const background = getComputedStyle(element).backgroundColor;

    return Number.parseFloat(background.slice(background.lastIndexOf(",") + 1));
  });
  expect(opacity).toBeGreaterThan(0);
  expect(opacity).toBeLessThan(1);
  await expect(dialog.getByRole("button")).toHaveCount(0);
  await expect(dialog).toHaveText("");
  await expect(activeImage(page)).toHaveAttribute("alt", "展位贴图原图 1");
  await page.screenshot({ path: test.info().outputPath("downward-drag.png") });
  await page.waitForTimeout(100);
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(dialog).toHaveCount(0);
  await session.detach();
  await expect(map).toHaveAttribute("viewBox", view!);
  expect(
    await page.evaluate(() => {
      return visualViewport!.scale;
    }),
  ).toBe(1);
  await open(page);
  await dismissSettled(page);
  expect(await imageTransform(page)).toEqual({ scale: 1, x: 0, y: 0 });
});

test("短下拖、上滑、反向拖回和系统取消均回弹，快速下甩可关闭", async ({ page }) => {
  await prepare(page, 1);
  await open(page);
  await verticalDrag(page, [20, 40, 70], 120);
  await dismissSettled(page);
  await verticalDrag(page, [-40, -100, -160]);
  await dismissSettled(page);
  await verticalDrag(page, [20, 80, 160, 230, 180], 120);
  await dismissSettled(page);
  await verticalDrag(page, [20, 80, 160, 200], 0, true);
  await dismissSettled(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await verticalDrag(page, [12, 70]);
  await expect(page.getByRole("dialog", { name: "展位贴图原图" })).toHaveCount(0);
});

test("下滑中加入双指会取消退出，放大后的下滑只移动图片", async ({ page }) => {
  await prepare(page);
  await open(page);
  const point = await center(page.locator(".viewer-stage"));
  const session = await page.context().newCDPSession(page);
  const start = { x: point.x - 40, y: point.y - 100, id: 1 };
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
  for (const distance of [30, 80, 160, 180]) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...start, y: start.y + distance }],
    });
  }
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { ...start, y: start.y + 180 },
      { x: point.x + 40, y: start.y + 180, id: 2 },
    ],
  });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await session.detach();
  await dismissSettled(page);
  await pinch(page, 80, 240);
  await verticalDrag(page, [30, 80, 160, 200]);
  await dismissSettled(page);
  await settled(page, 1);
  const transform = await imageTransform(page);
  expect(transform.scale).toBeCloseTo(3, 1);
  expect(transform.y).toBeGreaterThan(80);
});
