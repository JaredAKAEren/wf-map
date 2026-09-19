import { expect, test, type Page } from "@playwright/test";

async function searchFor(page: Page, query: string) {
  await page.getByRole("button", { name: "搜索展商或展位", exact: true }).click();
  const input = page.getByRole("textbox", { name: "搜索展商或展位号" });
  await expect(input).toBeFocused();
  await input.fill(query);
}

async function viewOf(page: Page) {
  return (await page
    .getByRole("img", { name: "五馆展位地图，可拖动和缩放" })
    .getAttribute("viewBox"))!
    .split(" ")
    .map(Number);
}

async function mapPoint(page: Page, x: number, y: number) {
  const box = (await page.locator("svg.map").boundingBox())!;
  const [vx = 0, vy = 0, width = 1, height = 1] = await viewOf(page);
  const scale = Math.min(box.width / width, box.height / height);

  return {
    x: box.x + (box.width - width * scale) / 2 + (x - vx) * scale,
    y: box.y + (box.height - height * scale) / 2 + (y - vy) * scale,
  };
}

test("缺少 Array.toSorted 时仍能搜索并定位展位", async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(Array.prototype, "toSorted");
  });
  await page.goto("/");
  await searchFor(page, "amimi");

  const result = page
    .getByRole("region", { name: "搜索结果" })
    .getByRole("button", { name: /A28/ });
  await expect(result).toBeVisible();
  await result.click();
  await expect(page.getByRole("heading", { name: "A28", exact: true })).toBeVisible();
});

test("搜索列表先选后跳转，展位查看状态可恢复", async ({ page }) => {
  await page.goto("/");
  const initial = await viewOf(page);
  await searchFor(page, "amimi");
  await expect(page.getByRole("region", { name: "搜索结果" })).toContainText("A28");
  expect(await viewOf(page)).toEqual(initial);
  await expect(page.getByRole("complementary", { name: "展位详情" })).toHaveCount(0);
  await page.getByRole("region", { name: "搜索结果" }).getByRole("button", { name: /A28/ }).click();
  await expect(page.getByRole("heading", { name: "A28", exact: true })).toBeVisible();
  // 回单馆后直接点击真实地图 A26 的区域。
  await page.getByRole("button", { name: "W5", exact: true }).click();
  await expect
    .poll(async () => {
      return (await viewOf(page))[2];
    })
    .toBe(700);
  const point = await mapPoint(page, 3440 + 330, 285);
  await page.mouse.click(point.x, point.y);
  await expect(page.getByRole("heading", { name: "A26", exact: true })).toBeVisible();
  await expect
    .poll(() => {
      return page.evaluate((): Record<string, unknown> => {
        return JSON.parse(localStorage.getItem("CapacitorStorage.wf-map/session-v1") ?? "{}");
      });
    })
    .toMatchObject({ selectedId: "wf2026/W5/A26", hall: "W5" });
  await expect(page.getByRole("button", { name: "我在这里", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "设为目标", exact: true })).toHaveCount(0);
  await searchFor(page, "A34");
  await page.getByRole("region", { name: "搜索结果" }).getByRole("button", { name: /A34/ }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "A34", exact: true })).toBeVisible();
  await searchFor(page, "xyz987xyz");
  await expect(page.getByRole("status")).toContainText("未找到");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A34", exact: true })).toBeVisible();
});

test("切馆及缩放有中间帧，双击与双击拖动不误选展位", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "W1", exact: true }).click();
  await expect
    .poll(async () => {
      return (await viewOf(page))[0];
    })
    .toBe(50);
  await page.getByRole("button", { name: "W5", exact: true }).click();
  const during = (await viewOf(page))[0]!;
  expect(during).toBeLessThan(3490);
  await expect
    .poll(async () => {
      return (await viewOf(page))[0];
    })
    .toBe(3490);
  const width = (await viewOf(page))[2]!;
  await page.mouse.dblclick(180, 400, { delay: 90 });
  await expect
    .poll(async () => {
      return (await viewOf(page))[2];
    })
    .toBe(width / 2);
  await expect(page.getByRole("complementary", { name: "展位详情" })).toHaveCount(0);
  await page.mouse.click(180, 400);
  await page.mouse.move(180, 400);
  await page.mouse.down();
  await page.mouse.move(180, 500, { steps: 5 });
  expect((await viewOf(page))[2]!).toBeGreaterThan(width / 2);
  await page.mouse.move(180, 300, { steps: 5 });
  expect((await viewOf(page))[2]!).toBeLessThan(width / 2);
  await page.mouse.up();
  await expect(page.getByRole("complementary", { name: "展位详情" })).toHaveCount(0);
});

test("减少动态效果直接到位，旧位置记录清理，照片能力和离线资源保持", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem(
      "CapacitorStorage.wf-map/session-v1",
      JSON.stringify({
        targetId: "wf2026/W5/A26",
        locationId: "wf2026/W5/A28",
        neighborId: "wf2026/W5/A23",
        locationAt: "2026-09-08T12:00:00Z",
        hall: "W5",
      }),
    );
  });
  const external: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:4173")) {
      external.push(request.url());
    }
  });
  await page.goto("/");
  await page.getByRole("button", { name: "W1", exact: true }).click();
  expect((await viewOf(page))[0]).toBe(50);
  for (const hall of ["W1", "W2", "W3", "W4", "W5"]) {
    expect((await page.request.get(`/maps/${hall}.png`)).ok()).toBe(true);
  }
  await searchFor(page, "A28");
  await page.getByRole("region", { name: "搜索结果" }).getByRole("button", { name: /A28/ }).click();
  await page.getByRole("button", { name: "展位照片与详情 ↑" }).click();
  await expect(page.getByRole("button", { name: "＋ 关联照片" })).toBeDisabled();
  await expect(page.getByText(/当前位置|目标展位|上次确认/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "更多地图选项" })).toHaveCount(0);
  await expect
    .poll(() => {
      return page.evaluate((): Record<string, unknown> => {
        return JSON.parse(localStorage.getItem("CapacitorStorage.wf-map/session-v1") ?? "{}");
      });
    })
    .not.toMatchObject({
      targetId: expect.anything(),
      locationId: expect.anything(),
      locationAt: expect.anything(),
    });
  expect(external).toEqual([]);
});

test("双指缩放与取消不误选，动画可被拖动接管", async ({ page, context }) => {
  await page.goto("/");
  const cdp = await context.newCDPSession(page);
  const initial = (await viewOf(page))[2]!;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: 100, y: 400, id: 0 },
      { x: 250, y: 400, id: 1 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: 70, y: 400, id: 0 },
      { x: 280, y: 400, id: 1 },
    ],
  });
  expect((await viewOf(page))[2]!).toBeLessThan(initial);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await expect(page.getByRole("complementary", { name: "展位详情" })).toHaveCount(0);
  await page.getByRole("button", { name: "W1", exact: true }).click();
  await page.mouse.move(190, 400);
  await page.mouse.down();
  await page.mouse.move(160, 440, { steps: 4 });
  await page.mouse.up();
  const interrupted = await viewOf(page);
  // 越过相机动画的完整时长，确认旧动画没有继续覆盖拖动结果。
  await page.waitForTimeout(400);
  expect(await viewOf(page)).toEqual(interrupted);
  await expect(page.getByRole("complementary", { name: "展位详情" })).toHaveCount(0);
});

test("图标按钮的图形位于按钮正中心", async ({ page }) => {
  await page.goto("/");
  for (const name of ["搜索展商或展位", "放大地图", "缩小地图"]) {
    const button = page.getByRole("button", { name, exact: true });
    const icon = button.locator("svg");
    await expect(icon).toHaveCount(1);
    const box = (await button.boundingBox())!;
    const graphic = (await icon.boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - graphic.x - graphic.width / 2)).toBeLessThan(1);
    expect(Math.abs(box.y + box.height / 2 - graphic.y - graphic.height / 2)).toBeLessThan(1);
  }
});

test("点地图空白处关闭搜索与详情，拖动地图不误关闭", async ({ page }) => {
  await page.goto("/");
  await searchFor(page, "A34");
  await page.getByRole("region", { name: "搜索结果" }).getByRole("button", { name: /A34/ }).click();
  await expect(page.getByRole("complementary", { name: "展位详情" })).toBeVisible();
  await page.mouse.move(10, 450);
  await page.mouse.down();
  await page.mouse.move(10, 490, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole("complementary", { name: "展位详情" })).toBeVisible();
  // A34 聚焦后 x=10 的地图边缘为展位外空白。
  const sheet = page.getByRole("complementary", { name: "展位详情" });
  await page.mouse.click(10, 450);
  await expect(sheet).toHaveClass(/sheet-leave-active/, { timeout: 100 });
  await expect(sheet).toHaveCount(0);
  await searchFor(page, "A28");
  const searchPanel = page.locator(".search-panel");
  await page.mouse.click(10, 450);
  await expect(searchPanel).toHaveClass(/search-expand-leave-active/, { timeout: 100 });
  await expect(page.getByRole("region", { name: "搜索结果" })).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
});

test("详情横条下滑关闭，短拖动回弹且不展开照片", async ({ page }) => {
  await page.goto("/");
  await searchFor(page, "A34");
  await page.getByRole("region", { name: "搜索结果" }).getByRole("button", { name: /A34/ }).click();
  const handle = page.getByRole("button", { name: "展开或收起展位详情，下滑关闭" });
  await expect(handle).toBeVisible();
  await expect(page.getByRole("button", { name: "关闭展位详情", exact: true })).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "展位详情" })).not.toHaveClass(
    /sheet-enter-active/,
  );
  const box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 24, { steps: 4 });
  await page.mouse.up();
  await expect(handle).toHaveAttribute("aria-expanded", "false");
  await expect
    .poll(async () => {
      return Math.round((await handle.boundingBox())!.y);
    })
    .toBe(Math.round(box.y));
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 100, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByRole("complementary", { name: "展位详情" })).toHaveCount(0);
});

test("搜索条与列表围绕搜索图标收拢，列表宽度保持稳定", async ({ page }) => {
  await page.goto("/");
  await searchFor(page, "A34");
  const panel = page.locator(".search-panel");
  await expect(page.getByRole("region", { name: "搜索结果" })).toBeVisible();
  const initialWidth = await panel.evaluate((element) => {
    return element.clientWidth;
  });
  await page.getByRole("button", { name: "取消", exact: true }).click();
  const closing = await panel.evaluate(async (element) => {
    // Vue 在后续帧切换 leave-to，不能在 click 返回的同一帧读取动画。
    await new Promise<void>((resolve) => {
      return requestAnimationFrame(() => {
        return requestAnimationFrame(() => {
          return resolve();
        });
      });
    });
    return {
      width: element.clientWidth,
      origin: getComputedStyle(element).transformOrigin,
      transform: getComputedStyle(element).transform,
    };
  });
  expect(closing.width).toBe(initialWidth);
  expect(closing.origin).toBe("24px 24px");
  expect(closing.transform).not.toBe("none");
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("button", { name: "搜索展商或展位", exact: true })).toBeFocused();
});

test("清除搜索内容后输入框保持聚焦", async ({ page }) => {
  await page.goto("/");
  await searchFor(page, "海洋堂");
  const input = page.getByRole("textbox", { name: "搜索展商或展位号" });
  const clear = page.getByRole("button", { name: "清除搜索内容", exact: true });

  await expect(clear).toBeVisible();
  await clear.click();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  await expect(clear).toHaveCount(0);
  await expect(page.getByRole("region", { name: "搜索结果" })).toContainText("输入展商名称");
});

test("可视区域高度变化时地图平滑缩放", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 800 });
  await page.goto("/");
  const map = page.locator("svg.map");
  const initialHeight = (await map.boundingBox())!.height;

  await page.setViewportSize({ width: 412, height: 500 });
  await page.waitForTimeout(40);
  const shrinkingHeight = (await map.boundingBox())!.height;
  expect(shrinkingHeight).toBeLessThan(initialHeight);
  expect(shrinkingHeight).toBeGreaterThan(500);
  await expect
    .poll(async () => {
      return Math.round((await map.boundingBox())!.height);
    })
    .toBe(500);

  await page.setViewportSize({ width: 412, height: 800 });
  await page.waitForTimeout(40);
  const growingHeight = (await map.boundingBox())!.height;
  expect(growingHeight).toBeGreaterThan(500);
  expect(growingHeight).toBeLessThan(800);
  await expect
    .poll(async () => {
      return Math.round((await map.boundingBox())!.height);
    })
    .toBe(800);
});
