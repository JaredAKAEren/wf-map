import { devices, expect, test } from "@playwright/test";

test("Pages 子路径安装后可断网打开地图并搜索", async ({ page, context }) => {
  await page.goto("/wf-map/");

  const manifest = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifest).toBe("/wf-map/manifest.webmanifest");
  const contents = await page.request.get(manifest!);
  expect((await contents.json()).scope).toBe("/wf-map/");

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect(page.getByRole("button", { name: "添加到桌面" })).toBeVisible();
  await page.reload();
  await expect
    .poll(() => {
      return page.evaluate(() => {
        return Boolean(navigator.serviceWorker.controller);
      });
    })
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "搜索展商或展位" })).toBeVisible();
  for (const hall of ["W1", "W2", "W3", "W4", "W5"]) {
    const available = await page.evaluate(async (name) => {
      const response = await fetch(`/wf-map/maps/${name}.png`);

      return response.ok && (await response.blob()).size > 0;
    }, hall);
    expect(available).toBe(true);
  }

  await page.getByRole("button", { name: "搜索展商或展位" }).click();
  await page.getByRole("combobox").fill("A34");
  await page.getByRole("option", { name: /A34/ }).first().click();
  const sheetBox = await page.locator(".sheet-position").boundingBox();
  const viewportWidth = await page.evaluate(() => {
    return window.innerWidth;
  });
  expect(sheetBox).not.toBeNull();
  expect(sheetBox!.width).toBeLessThanOrEqual(520);
  expect(Math.abs(sheetBox!.x + sheetBox!.width / 2 - viewportWidth / 2)).toBeLessThan(2);
  await page.getByRole("button", { name: "展开贴图" }).click();
  const photoColumns = await page.locator(".photo-grid").evaluate((element) => {
    return getComputedStyle(element).gridTemplateColumns.split(" ").length;
  });
  expect(photoColumns).toBe(4);
  await page.locator('input[type="file"]').setInputFiles("tests-pages/fixtures/pixel.png");
  await expect(page.getByRole("button", { name: "查看原图" })).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "展开贴图" }).click();
  await expect(page.getByRole("button", { name: "查看原图" })).toHaveCount(1);
});

test("移动端安装引导可通过安装按钮关闭、重开，并显示 iOS 添加步骤", async ({ browser }) => {
  const context = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await context.newPage();
  await page.goto("/wf-map/");
  await expect(page.getByText("添加到主屏幕")).toBeVisible();
  await page.getByRole("button", { name: "添加到桌面" }).click();
  await expect(page.getByText("添加到主屏幕")).toHaveCount(0);
  await page.getByRole("button", { name: "添加到桌面" }).click();
  await expect(page.getByText("添加到主屏幕")).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(new Event("appinstalled"));
  });
  await expect(page.getByRole("button", { name: "添加到桌面" })).toHaveCount(0);
  await context.close();
});

test("应用 notice 使用统一 Toast 样式并可关闭", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("CapacitorStorage.wf-map/session-v1", "{");
  });
  await page.goto("/wf-map/");

  const notice = page.locator(".app-toast-title", {
    hasText: "上次视图无法恢复，已打开 W5 地图。",
  });

  await expect(notice).toBeVisible();
  await expect(page.locator(".app-toast")).toHaveCount(1);
  await page.getByRole("button", { name: "关闭提示" }).click();
  await expect(notice).toHaveCount(0);
});

test("新版本完成后台缓存后提示用户刷新", async ({ page }) => {
  await page.goto("/wf-map/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect(page.getByRole("button", { name: "添加到桌面" })).toBeVisible();
  await page.evaluate(() => {
    const waiting = {
      postMessage(message: string) {
        sessionStorage.setItem("pwa-update-message", message);
      },
    };

    window.dispatchEvent(
      new CustomEvent("wf-map:pwa-update-ready", {
        detail: { waiting },
      }),
    );
  });

  await expect(page.locator(".pwa-update-toast .app-toast-title")).toHaveText("新版本已准备好");
  await page.locator(".pwa-update-toast").evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => {
        return animation.finished;
      }),
    );
  });
  const headerBox = await page.locator(".map-header").boundingBox();
  const searchBox = await page.getByRole("button", { name: "搜索展商或展位" }).boundingBox();
  const installBox = await page.getByRole("button", { name: "添加到桌面" }).boundingBox();
  const hallBox = await page.locator(".hall-position").boundingBox();
  const viewportBox = await page.locator(".app-toast-viewport").boundingBox();
  const toastBox = await page.locator(".pwa-update-toast").boundingBox();
  const viewportWidth = await page.evaluate(() => {
    return window.innerWidth;
  });
  const viewportHeight = await page.evaluate(() => {
    return window.innerHeight;
  });
  expect(headerBox).not.toBeNull();
  expect(searchBox).not.toBeNull();
  expect(installBox).not.toBeNull();
  expect(hallBox).not.toBeNull();
  expect(viewportBox).not.toBeNull();
  expect(toastBox).not.toBeNull();
  expect(toastBox!.width).toBeLessThan(240);
  expect(toastBox!.height).toBeLessThanOrEqual(56);
  expect(Math.abs(searchBox!.x - 12)).toBeLessThan(2);
  expect(Math.abs(viewportWidth - (installBox!.x + installBox!.width) - 12)).toBeLessThan(2);
  expect(Math.abs(hallBox!.x + hallBox!.width / 2 - viewportWidth / 2)).toBeLessThan(2);
  expect(hallBox!.y).toBeGreaterThan(viewportHeight / 2);
  expect(Math.abs(viewportWidth - (toastBox!.x + toastBox!.width) - 12)).toBeLessThan(2);
  expect(toastBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
  expect(toastBox!.y - (headerBox!.y + headerBox!.height)).toBeLessThanOrEqual(12);
  const toastStyle = await page.locator(".pwa-update-toast").evaluate((element) => {
    const style = getComputedStyle(element);

    return { borderRadius: style.borderRadius, boxShadow: style.boxShadow };
  });
  expect(toastStyle.borderRadius).toBe("12px");
  expect(toastStyle.boxShadow).not.toBe("none");
  expect(Math.abs(viewportBox!.width - toastBox!.width)).toBeLessThan(2);
  const formerBlankAreaBlocked = await page.evaluate(
    ({ x, y }) => {
      return Boolean(document.elementFromPoint(x, y)?.closest(".app-toast-viewport"));
    },
    { x: headerBox!.x + 1, y: toastBox!.y + toastBox!.height / 2 },
  );
  expect(formerBlankAreaBlocked).toBe(false);
  await page.getByRole("button", { name: "搜索展商或展位" }).click();
  const searchPanelBox = await page.locator(".search-panel").boundingBox();
  expect(searchPanelBox).not.toBeNull();
  expect(searchPanelBox!.y + searchPanelBox!.height).toBeLessThan(hallBox!.y);
  await page.getByRole("button", { name: "取消" }).click();
  await page.getByRole("button", { name: "刷新", exact: true }).click();
  await expect
    .poll(() => {
      return page.evaluate(() => {
        return sessionStorage.getItem("pwa-update-message");
      });
    })
    .toBe("SKIP_WAITING");
});
