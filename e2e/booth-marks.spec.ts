import { expect, test, type Page } from "@playwright/test";

const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
  "base64",
);

async function search(page: Page, query = "") {
  await page.getByRole("button", { name: "搜索展商或展位", exact: true }).click();
  await page.getByRole("combobox").fill(query);
}

async function choose(page: Page, code: string) {
  await search(page, code);
  await page.getByRole("option", { name: new RegExp(`W5 · ${code}`) }).click();
}

async function filterMenu(page: Page) {
  await page.getByRole("button", { name: /^筛选展位/u }).click();
  return page.getByRole("menu", { name: /^筛选展位/u });
}

test("收藏可取消并在重开后恢复，点星标不展开贴图", async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener("animationstart", (event) => {
      if (
        event.animationName.startsWith("favorite-pop") &&
        event.target instanceof Element &&
        event.target.closest(".favorite-button")
      ) {
        const root = document.documentElement;
        root.dataset.favoriteAnimations = String(Number(root.dataset.favoriteAnimations ?? 0) + 1);
      }
    });
  });
  await page.goto("/");
  await choose(page, "A34");
  const favorite = page.getByRole("button", { name: "收藏展位", exact: true });
  await expect(favorite).toHaveAttribute("aria-pressed", "false");
  await favorite.click();
  await expect(page.getByRole("button", { name: "取消收藏", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "展开贴图" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(page.locator("html")).toHaveAttribute("data-favorite-animations", "1");
  await page.reload();
  await expect(page.getByRole("button", { name: "取消收藏", exact: true })).toBeVisible();
  await choose(page, "A37");
  await choose(page, "A34");
  await expect(page.getByRole("button", { name: "取消收藏", exact: true })).toBeVisible();
  expect(
    await page.locator(".favorite-button svg").evaluate((svg) => {
      return getComputedStyle(svg).animationName;
    }),
  ).toBe("none");
  await expect(page.locator("html")).not.toHaveAttribute("data-favorite-animations", /.+/u);
  await page.getByRole("button", { name: "取消收藏", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "收藏展位", exact: true })).toBeVisible();
});

test("收藏星在详情退出动画中保持点亮，其他展位不继承收藏状态", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const states: string[] = [];

    function record(event: AnimationEvent) {
      if (!event.animationName.startsWith("sheet-out") || !(event.target instanceof Element)) {
        return;
      }

      states.push(
        event.target.querySelector(".favorite-button")?.getAttribute("aria-pressed") ?? "missing",
      );
      document.documentElement.dataset.closingFavoriteStates = states.join(",");
    }

    document.addEventListener("animationstart", record, true);
    document.addEventListener("animationend", record, true);
  });
  await page.goto("/");
  await choose(page, "A34");
  await page.getByRole("button", { name: "收藏展位", exact: true }).click();
  await expect(page.getByRole("button", { name: "取消收藏", exact: true })).toBeVisible();
  await page.mouse.click(10, 450);
  await expect(page.locator(".booth-sheet")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-closing-favorite-states", "true,true");
  await choose(page, "A37");
  await expect(page.getByRole("button", { name: "收藏展位", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await choose(page, "A34");
  await expect(page.getByRole("button", { name: "取消收藏", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("收藏写入失败时保留原状态并提示", async ({ page }) => {
  await page.addInitScript(() => {
    const setItem = Reflect.get(Storage.prototype, "setItem");
    Storage.prototype.setItem = function (key, value) {
      if (key.endsWith("wf-map/favorites-v1")) {
        throw new DOMException("磁盘已满", "QuotaExceededError");
      }

      Reflect.apply(setItem, this, [key, value]);
    };
  });
  await page.goto("/");
  await choose(page, "A34");
  await page.getByRole("button", { name: "收藏展位", exact: true }).click();
  await expect(page.getByText("收藏保存失败，请重试。", { exact: true })).toContainText(
    "收藏保存失败",
  );
  await expect(page.getByRole("button", { name: "收藏展位", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("筛选多选取交集，继续搜索与清空只在筛选范围展示", async ({ page }) => {
  await page.goto("/");
  await choose(page, "A34");
  await page.getByRole("button", { name: "收藏展位", exact: true }).click();
  await page.getByRole("button", { name: "展开贴图" }).click();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: image });
  await expect(page.getByRole("button", { name: "查看原图" })).toHaveCount(1);
  await choose(page, "A28");
  await page.getByRole("button", { name: "收藏展位", exact: true }).click();

  await search(page);
  const menu = await filterMenu(page);
  await menu.getByRole("menuitemcheckbox", { name: "已收藏" }).click();
  await expect(page.getByRole("option")).toHaveCount(2);
  await menu.getByRole("menuitemcheckbox", { name: "已贴图" }).click();
  await expect(page.getByRole("option")).toHaveCount(1);
  await expect(page.getByRole("option")).toContainText("A34");
  await expect(menu.getByRole("menuitemcheckbox", { name: "已贴图" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(page.getByRole("combobox")).toBeVisible();
  await page.getByRole("combobox").fill("A28");
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(page.getByRole("listbox")).toContainText("没有符合筛选条件");
  await page.getByRole("button", { name: "清除搜索内容" }).click();
  await expect(page.getByRole("option")).toHaveCount(1);
  await page.getByRole("option").click();
  await page.getByRole("button", { name: "展开贴图" }).click();
  await page.getByRole("button", { name: "查看原图" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "解除关联" }).click();
  await expect(page.getByRole("button", { name: "查看原图" })).toHaveCount(0);
  await search(page);
  await expect(page.getByRole("option")).toHaveCount(0);
  const reopened = await filterMenu(page);
  await reopened.getByRole("menuitemcheckbox", { name: "已收藏" }).click();
  await reopened.getByRole("menuitemcheckbox", { name: "已贴图" }).click();
  await expect(page.getByRole("listbox")).toContainText("输入展商名称");
});

test("窄屏收藏与筛选控件保持可视，地图不显示状态标记", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await choose(page, "A25");
  await page.getByRole("button", { name: "收藏展位", exact: true }).click();
  await expect(page.getByRole("button", { name: "取消收藏", exact: true })).toBeVisible();
  await expect(page.locator(".booth-markers")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("favorite-sheet.png") });

  await search(page);
  const input = (await page.locator(".search-form").boundingBox())!;
  const button = (await page.getByRole("button", { name: /^筛选展位/u }).boundingBox())!;
  expect(button.x).toBeGreaterThan(input.x + input.width);
  expect(button.x + button.width).toBeLessThanOrEqual(320);
  const menu = await filterMenu(page);
  await menu.getByRole("menuitemcheckbox", { name: "已收藏" }).click();
  await expect(page.getByRole("option")).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("favorite-filters.png") });
});
