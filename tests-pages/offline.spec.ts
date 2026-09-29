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
  await page.getByRole("button", { name: "展开贴图" }).click();
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
