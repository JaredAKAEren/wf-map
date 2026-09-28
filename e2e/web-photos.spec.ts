import { expect, test, type Page } from "@playwright/test";

const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
  "base64",
);

async function choose(page: Page, code: string) {
  await page.getByRole("button", { name: "搜索展商或展位", exact: true }).click();
  await page.getByRole("combobox").fill(code);
  await page
    .getByRole("option", { name: new RegExp(code) })
    .first()
    .click();
  await page.getByRole("button", { name: "展开贴图" }).click();
}

async function upload(page: Page, name = "fixture.png") {
  await page.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: "image/png",
    buffer: image,
  });
}

test("网页贴图可保存、去重、改绑并解除关联", async ({ page }) => {
  await page.goto("/");
  await choose(page, "A34");
  await upload(page);
  await expect(page.getByRole("button", { name: "查看原图" })).toHaveCount(1);
  await page.reload();
  await choose(page, "A34");
  await expect(page.getByRole("button", { name: "查看原图" })).toHaveCount(1);
  await upload(page, "same-content.png");
  await expect(page.getByRole("button", { name: "查看原图" })).toHaveCount(1);

  await choose(page, "A28");
  await upload(page);
  await expect(page.getByRole("alertdialog", { name: "更改贴图关联？" })).toBeVisible();
  await page.getByRole("button", { name: "取消" }).click();
  await expect(page.getByRole("button", { name: "查看原图" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "添加贴图" })).toBeEnabled();
  await upload(page);
  await expect(page.getByRole("alertdialog", { name: "更改贴图关联？" })).toBeVisible();
  await page.getByRole("button", { name: "确认更改" }).click();
  await expect(page.getByRole("button", { name: "查看原图" })).toHaveCount(1);
  await page.getByRole("button", { name: "查看原图" }).click();
  await expect(page.getByRole("dialog", { name: "展位贴图原图" })).toBeVisible();
  await page.getByRole("button", { name: "关闭原图" }).click();

  await page.getByRole("button", { name: "查看原图" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "解除关联" }).click();
  await expect(page.getByRole("button", { name: "查看原图" })).toHaveCount(0);
  await page.reload();
  await choose(page, "A28");
  await expect(page.getByRole("button", { name: "查看原图" })).toHaveCount(0);
});

test("浏览器存储空间不足时不显示已保存贴图", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Reflect.get(IDBObjectStore.prototype, "put");
    IDBObjectStore.prototype.put = function (...arguments_: Parameters<IDBObjectStore["put"]>) {
      if (this.name === "photos") {
        throw new DOMException("磁盘已满", "QuotaExceededError");
      }

      return Reflect.apply(original, this, arguments_);
    };
  });
  await page.goto("/");
  await choose(page, "A34");
  await upload(page);
  await expect(page.getByRole("status")).toContainText("浏览器存储空间不足");
  await expect(page.getByRole("button", { name: "查看原图" })).toHaveCount(0);
});
