import { expect, test, type Page } from "@playwright/test";

async function searchFor(page: Page, query: string) {
  await page.getByRole("button", { name: "搜索展商或展位", exact: true }).click();
  const input = page.getByRole("combobox", { name: "搜索展商或展位号" });
  await expect(input).toBeFocused();
  await input.fill(query);
}

function searchResults(page: Page) {
  return page.getByRole("listbox", { name: "搜索结果" });
}

function searchResult(page: Page, name: RegExp) {
  return searchResults(page).getByRole("option", { name });
}

async function mockNativePhotos(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("wf-map-test-photo-mode", "normal");
    localStorage.setItem("wf-map-test-photo-assignments", "0");
    localStorage.setItem("wf-map-test-photo-releases", "0");
    localStorage.setItem("wf-map-test-photo-replacements", "0");
    Reflect.set(window, "androidBridge", {});
    Reflect.set(window, "Capacitor", {
      PluginHeaders: [
        {
          name: "Preferences",
          methods: [
            { name: "get", rtype: "promise" },
            { name: "set", rtype: "promise" },
          ],
        },
        {
          name: "ExhibitionPhotos",
          methods: ["pick", "list", "assign", "thumbnail", "open", "remove", "releaseUnlinked"].map(
            (name) => {
              return { name, rtype: "promise" as const };
            },
          ),
        },
      ],
      async nativePromise(
        pluginName: string,
        methodName: string,
        options: Record<string, unknown>,
      ) {
        if (pluginName === "Preferences") {
          return methodName === "get" ? { value: null } : undefined;
        }
        if (methodName === "pick") {
          if (localStorage.getItem("wf-map-test-photo-mode") === "pick-error") {
            throw new Error("pick failed");
          }

          return { failed: 0, uris: ["content://photo-1", "content://photo-2"] };
        }
        if (methodName === "list") {
          return { photos: [] };
        }
        if (methodName === "assign") {
          const assignments = Number(localStorage.getItem("wf-map-test-photo-assignments"));
          localStorage.setItem("wf-map-test-photo-assignments", String(assignments + 1));
          if (options.replace) {
            const count = Number(localStorage.getItem("wf-map-test-photo-replacements"));
            localStorage.setItem("wf-map-test-photo-replacements", String(count + 1));
          }

          return options.replace ? {} : { conflict: "wf2026/W5/A28" };
        }
        if (methodName === "releaseUnlinked") {
          const releases = Number(localStorage.getItem("wf-map-test-photo-releases"));
          localStorage.setItem("wf-map-test-photo-releases", String(releases + 1));
        }

        return undefined;
      },
    });
  });
}

async function viewOf(page: Page) {
  return (await page.locator("svg.map").getAttribute("viewBox"))!.split(" ").map(Number);
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

  const result = searchResult(page, /A28/);
  await expect(result).toBeVisible();
  await result.click();
  await expect(page.getByRole("heading", { name: "A28", exact: true })).toBeVisible();
});

test("细分编号可搜索并定位所属主分区，空名记录显示待补充", async ({ page }) => {
  await page.goto("/");
  await searchFor(page, "W1-A1-06");

  const result = searchResult(page, /W1 · A1-06/);
  await expect(result).toBeVisible();
  await result.click();
  await expect(page.getByRole("heading", { name: "A1", exact: true })).toBeVisible();

  await searchFor(page, "W1-B4-03");
  await expect(searchResult(page, /W1 · B4-03.*名称待补充/)).toBeVisible();
});

test("个人摊位均分两列，编号与缺失名称完整显示", async ({ page }) => {
  for (const width of [320, 360, 700]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await searchFor(page, "W1E8");
    await searchResult(page, /W1 · E8/).click();
    await expect(page.getByRole("heading", { name: "E8", exact: true })).toBeVisible();

    const columns = page.locator(".personal-column");
    await expect(columns).toHaveCount(2);
    await expect(columns.nth(0).locator(".booth-entry")).toHaveCount(6);
    await expect(columns.nth(1).locator(".booth-entry")).toHaveCount(7);
    await expect(page.locator(".booth-slot")).toHaveText([
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "08",
      "09",
      "10",
      "11",
      "12",
      "13",
    ]);
    const layout = await page.locator(".personal-entries").evaluate((element) => {
      return {
        width: element.clientWidth,
        content: element.scrollWidth,
        wordBreak: getComputedStyle(element.querySelector(".booth-entry-name")!).wordBreak,
      };
    });
    expect(layout.content).toBeLessThanOrEqual(layout.width);
    expect(layout.wordBreak).toBe("normal");
    const widths = await page.locator(".booth-slot").evaluateAll((elements) => {
      return elements.map((element) => {
        return element.getBoundingClientRect().width;
      });
    });
    expect(new Set(widths).size).toBe(1);
  }

  await searchFor(page, "W1-B4-03");
  await searchResult(page, /W1 · B4-03/).click();
  await expect(
    page.locator(".booth-entry", { has: page.locator(".booth-slot", { hasText: "03" }) }),
  ).toContainText("名称待补充");
});

test("搜索选择和地图点选都把展位框移到详情卡上方，地图点选不缩放", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  const initialWidth = (await viewOf(page))[2];
  const point = await mapPoint(page, 250, 1310);
  await page.mouse.click(point.x, point.y);
  await expect(page.getByRole("heading", { name: "A37", exact: true })).toBeVisible();
  await expect
    .poll(async () => {
      const booth = (await page.locator(".selected-booth").boundingBox())!;
      const sheet = (await page.locator(".sheet-position").boundingBox())!;
      const hall = (await page.getByRole("group", { name: "展馆选择" }).boundingBox())!;

      return booth.y > hall.y + hall.height + 8 && booth.y + booth.height < sheet.y - 8;
    })
    .toBe(true);
  expect((await viewOf(page))[2]).toBe(initialWidth);

  await searchFor(page, "W5A37");
  await searchResult(page, /W5 · A37/).click();
  await expect
    .poll(async () => {
      return (await viewOf(page))[2];
    })
    .toBe(420);
  const booth = (await page.locator(".selected-booth").boundingBox())!;
  const sheet = (await page.locator(".sheet-position").boundingBox())!;
  const hall = (await page.getByRole("group", { name: "展馆选择" }).boundingBox())!;
  expect(booth.y).toBeGreaterThan(hall.y + hall.height + 8);
  expect(booth.y + booth.height).toBeLessThan(sheet.y - 8);
});

test("未被详情卡遮挡时保持原视野", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  const initial = await viewOf(page);
  const clearPoint = await mapPoint(page, 250, 1010);
  await page.mouse.click(clearPoint.x, clearPoint.y);
  await expect(page.getByRole("heading", { name: "A34", exact: true })).toBeVisible();
  await page.waitForTimeout(400);
  expect(await viewOf(page)).toEqual(initial);

  await searchFor(page, "W5A34");
  await searchResult(page, /W5 · A34/).click();
  await expect
    .poll(async () => {
      return await viewOf(page);
    })
    .toEqual([124 + 255 / 2 - 210, 948 + 159 / 2 - 260, 420, 520]);
});

test("被详情卡遮挡时只留少量间距", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  const coveredPoint = await mapPoint(page, 250, 1310);
  await page.mouse.click(coveredPoint.x, coveredPoint.y);
  await expect(page.getByRole("heading", { name: "A37", exact: true })).toBeVisible();
  await expect
    .poll(async () => {
      const booth = (await page.locator(".selected-booth").boundingBox())!;
      const sheet = (await page.locator(".sheet-position").boundingBox())!;

      return sheet.y - (booth.y + booth.height);
    })
    .toBeGreaterThan(10);
  const booth = (await page.locator(".selected-booth").boundingBox())!;
  const sheet = (await page.locator(".sheet-position").boundingBox())!;
  expect(sheet.y - (booth.y + booth.height)).toBeLessThan(15);
});

test("搜索列表先选后跳转，展位查看状态可恢复", async ({ page }) => {
  await page.goto("/");
  const initial = await viewOf(page);
  await searchFor(page, "amimi");
  await expect(searchResults(page)).toContainText("A28");
  expect(await viewOf(page)).toEqual(initial);
  await expect(page.getByRole("dialog", { name: "展位详情" })).toHaveCount(0);
  await searchResult(page, /A28/).click();
  await expect(page.getByRole("heading", { name: "A28", exact: true })).toBeVisible();
  // 回单馆后直接点击真实地图 A26 的区域。
  await page.getByRole("button", { name: "W5", exact: true }).click();
  await expect
    .poll(async () => {
      return (await viewOf(page))[2];
    })
    .toBe(700);
  const point = await mapPoint(page, 330, 285);
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
  await searchFor(page, "W5A34");
  await searchResult(page, /A34/).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "A34", exact: true })).toBeVisible();
  await searchFor(page, "xyz987xyz");
  await expect(page.getByRole("status")).toContainText("未找到");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A34", exact: true })).toBeVisible();
});

test("搜索复用 Combobox 的按键选择、关闭和中文输入保护", async ({ page }) => {
  await page.goto("/");
  await searchFor(page, "A34");
  const input = page.getByRole("combobox", { name: "搜索展商或展位号" });

  await input.press("Escape");
  await expect(input).toHaveCount(0);
  await page.getByRole("button", { name: "搜索展商或展位", exact: true }).click();
  const reopened = page.getByRole("combobox", { name: "搜索展商或展位号" });
  await expect(reopened).toHaveValue("A34");

  await reopened.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "A28" }));
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        code: "Enter",
        isComposing: true,
        key: "Enter",
      }),
    );
  });
  await expect(reopened).toBeVisible();
  await expect(page.getByRole("heading", { name: "A34", exact: true })).toHaveCount(0);
  await reopened.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "A28" }));
  });

  await reopened.fill("A28");
  await reopened.press("ArrowDown");
  await reopened.press("Enter");
  await expect(page.getByRole("heading", { name: "A28", exact: true })).toBeVisible();
});

test("照片改绑逐张确认，取消、确认与异常都保留原关联边界", async ({ page }) => {
  await mockNativePhotos(page);
  await page.goto("/");
  await searchFor(page, "W5A34");
  await searchResult(page, /A34/).click();
  await page.getByRole("button", { name: "展开贴图" }).click();
  const associate = page.getByRole("button", { name: "添加贴图" });

  await associate.click();
  await expect(page.getByRole("alertdialog")).toContainText("W5 A28");
  await expect(page.getByRole("alertdialog")).toContainText("W5 A34");
  await expect(page.getByRole("button", { name: "取消", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(associate).toBeEnabled();
  expect(
    await page.evaluate(() => {
      return Number(localStorage.getItem("wf-map-test-photo-replacements"));
    }),
  ).toBe(0);

  await associate.click();
  await page.getByRole("button", { name: "确认更改" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "确认更改" }).click();
  await expect(associate).toBeEnabled();
  expect(
    await page.evaluate(() => {
      return Number(localStorage.getItem("wf-map-test-photo-replacements"));
    }),
  ).toBe(2);

  await page.evaluate(() => {
    localStorage.setItem("wf-map-test-photo-mode", "pick-error");
  });
  await associate.click();
  await expect(page.locator(".notice[role='status']")).toContainText("关联未完成，请重试");
  await expect(associate).toBeEnabled();

  await page.evaluate(() => {
    localStorage.setItem("wf-map-test-photo-mode", "normal");
    localStorage.setItem("wf-map-test-photo-assignments", "0");
    localStorage.setItem("wf-map-test-photo-releases", "0");
  });
  await associate.click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.locator(".hall-position button").first().dispatchEvent("click");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect
    .poll(() => {
      return page.evaluate(() => {
        return {
          assignments: Number(localStorage.getItem("wf-map-test-photo-assignments")),
          releases: Number(localStorage.getItem("wf-map-test-photo-releases")),
        };
      });
    })
    .toEqual({ assignments: 1, releases: 1 });
});

test("切馆及缩放有中间帧，双击与双击拖动不误选展位", async ({ page }) => {
  await page.goto("/");
  expect((await viewOf(page))[0]).toBe(50);
  await page.getByRole("button", { name: "W1", exact: true }).click();
  await expect
    .poll(async () => {
      return (await viewOf(page))[0];
    })
    .toBe(3490);
  await page.getByRole("button", { name: "W5", exact: true }).click();
  const during = (await viewOf(page))[0]!;
  expect(during).toBeGreaterThan(50);
  await expect
    .poll(async () => {
      return (await viewOf(page))[0];
    })
    .toBe(50);
  const width = (await viewOf(page))[2]!;
  await page.mouse.dblclick(180, 400, { delay: 90 });
  await expect
    .poll(async () => {
      return (await viewOf(page))[2];
    })
    .toBe(width / 2);
  await expect(page.getByRole("dialog", { name: "展位详情" })).toHaveCount(0);
  await page.mouse.click(180, 400);
  await page.mouse.move(180, 400);
  await page.mouse.down();
  await page.mouse.move(180, 500, { steps: 5 });
  expect((await viewOf(page))[2]!).toBeGreaterThan(width / 2);
  await page.mouse.move(180, 300, { steps: 5 });
  expect((await viewOf(page))[2]!).toBeLessThan(width / 2);
  await page.mouse.up();
  await expect(page.getByRole("dialog", { name: "展位详情" })).toHaveCount(0);
});

test("当前馆长按有反馈，拖动时地图跟手并在松开后吸附", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  const w5 = page.getByRole("button", { name: "W5", exact: true });
  const w4 = page.getByRole("button", { name: "W4", exact: true });
  const w3 = page.getByRole("button", { name: "W3", exact: true });
  const switcher = page.getByRole("group", { name: "展馆选择" });
  await w4.evaluate((element) => {
    element.addEventListener("transitionrun", (event) => {
      if (event instanceof TransitionEvent && event.propertyName === "transform") {
        element.setAttribute("data-animated", "true");
      }
    });
  });
  const w5Box = (await w5.boundingBox())!;
  const w4Box = (await w4.boundingBox())!;
  const startX = w5Box.x + w5Box.width / 2;
  const y = w5Box.y + w5Box.height / 2;
  const step = w4Box.x + w4Box.width / 2 - startX;
  const initial = await viewOf(page);

  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.waitForTimeout(220);
  await expect(w5).not.toHaveClass(/is-held/);
  await page.waitForTimeout(120);
  await expect(w5).toHaveClass(/is-held/);
  const heldVisual = await switcher.evaluate((element) => {
    const background = getComputedStyle(element, "::before");
    const button = element.querySelector("button")!;

    return {
      width: button.getBoundingClientRect().width,
      background: background.backgroundColor,
    };
  });
  expect(heldVisual.width).toBeGreaterThan(w5Box.width);
  expect(heldVisual.background).toBe("rgb(244, 152, 15)");
  await expect
    .poll(async () => {
      return switcher.evaluate((element) => {
        return Number.parseFloat(getComputedStyle(element, "::before").width);
      });
    })
    .toBeGreaterThan(w5Box.width + 5);
  await page.mouse.up();
  await expect(w5).not.toHaveClass(/is-held/);
  expect(await viewOf(page)).toEqual(initial);

  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.waitForTimeout(380);
  await page.mouse.move(startX + step * 0.6, y, { steps: 4 });
  await expect(w4).toHaveClass(/is-held/);
  await expect(w4).toHaveAttribute("data-animated", "true");
  await expect(w5).not.toHaveClass(/is-held/);
  await expect
    .poll(async () => {
      return (await viewOf(page))[2];
    })
    .toBe(700);
  const intermediate = (await viewOf(page))[0]!;
  expect(intermediate).toBeGreaterThan(50);
  expect(intermediate).toBeLessThan(910);
  await page.mouse.move(startX + step * 2.1, y, { steps: 8 });
  await expect(w3).toHaveAttribute("data-state", "on");
  await expect(w3).toHaveClass(/is-held/);
  await expect(w4).not.toHaveClass(/is-held/);
  await page.mouse.move(startX + step * 0.2, y, { steps: 8 });
  await expect(w5).toHaveAttribute("data-state", "on");
  await expect
    .poll(async () => {
      return (await viewOf(page))[0];
    })
    .toBeLessThan(910);
  await page.mouse.move(startX + step * 2.1, y, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () => {
      return (await viewOf(page))[0];
    })
    .toBe(1770);
  await expect(w3).toHaveAttribute("data-state", "on");
  await expect(w5).not.toHaveClass(/is-held/);

  const w3Box = (await w3.boundingBox())!;
  const reverseX = w3Box.x + w3Box.width / 2;
  await page.mouse.move(reverseX, y);
  await page.mouse.down();
  await page.waitForTimeout(380);
  await page.mouse.move(reverseX - step * 2.5, y, { steps: 8 });
  await expect
    .poll(async () => {
      return (await viewOf(page))[0];
    })
    .toBe(50);
  await page.mouse.up();
  await expect
    .poll(async () => {
      return (await viewOf(page))[0];
    })
    .toBe(50);
  await expect(w5).toHaveAttribute("data-state", "on");
});

test("轻点切馆的高亮底色滑动到目标按钮", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  const w1 = page.getByRole("button", { name: "W1", exact: true });
  const switcher = page.getByRole("group", { name: "展馆选择" });
  await switcher.evaluate((element) => {
    element.addEventListener("transitionrun", (event) => {
      if (
        event instanceof TransitionEvent &&
        event.pseudoElement === "::before" &&
        event.propertyName === "left"
      ) {
        element.setAttribute("data-pill-animated", "true");
      }
    });
  });
  await w1.click();
  await expect(w1).toHaveAttribute("data-state", "on");
  await expect(switcher).toHaveAttribute("data-pill-animated", "true");
});

test("快速长按滑动与取消恢复原视野，普通切馆仍可点击", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  const w5 = page.getByRole("button", { name: "W5", exact: true });
  const w1 = page.getByRole("button", { name: "W1", exact: true });
  const w5Box = (await w5.boundingBox())!;
  const w1Box = (await w1.boundingBox())!;
  const startX = w5Box.x + w5Box.width / 2;
  const endX = w1Box.x + w1Box.width / 2;
  const y = w5Box.y + w5Box.height / 2;

  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.waitForTimeout(380);
  await page.mouse.move(endX, y, { steps: 2 });
  await page.mouse.up();
  await expect
    .poll(async () => {
      return (await viewOf(page))[0];
    })
    .toBe(3490);
  await page.getByRole("button", { name: "放大地图" }).click();
  await expect
    .poll(async () => {
      return (await viewOf(page))[2];
    })
    .toBe(525);
  const original = await viewOf(page);
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: endX, y, id: 0 }],
  });
  await page.waitForTimeout(380);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: endX - 110, y, id: 0 }],
  });
  await expect
    .poll(async () => {
      return (await viewOf(page))[0];
    })
    .toBeLessThan(3490);
  await session.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await expect
    .poll(async () => {
      return await viewOf(page);
    })
    .toEqual(original);
  await expect(w1).toHaveAttribute("data-state", "on");

  await w5.click();
  await expect
    .poll(async () => {
      return (await viewOf(page))[0];
    })
    .toBe(50);
  const touchStart = (await w5.boundingBox())!;
  const touchEnd = (await page.getByRole("button", { name: "W4", exact: true }).boundingBox())!;
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: touchStart.x + touchStart.width / 2, y, id: 1 }],
  });
  await page.waitForTimeout(380);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: touchEnd.x + touchEnd.width / 2, y, id: 1 }],
  });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect
    .poll(async () => {
      return (await viewOf(page))[0];
    })
    .toBe(910);
  await session.detach();
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
  expect((await viewOf(page))[0]).toBe(3490);
  for (const hall of ["W1", "W2", "W3", "W4", "W5"]) {
    expect((await page.request.get(`/maps/${hall}.png`)).ok()).toBe(true);
  }
  await searchFor(page, "W5A28");
  await searchResult(page, /A28/).click();
  await page.getByRole("button", { name: "展开贴图" }).click();
  await expect(page.getByRole("button", { name: "添加贴图" })).toBeDisabled();
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
  await expect(page.getByRole("dialog", { name: "展位详情" })).toHaveCount(0);
  await page.getByRole("button", { name: "W1", exact: true }).click();
  await page.mouse.move(190, 400);
  await page.mouse.down();
  await page.mouse.move(160, 440, { steps: 4 });
  await page.mouse.up();
  const interrupted = await viewOf(page);
  // 越过相机动画的完整时长，确认旧动画没有继续覆盖拖动结果。
  await page.waitForTimeout(400);
  expect(await viewOf(page)).toEqual(interrupted);
  await expect(page.getByRole("dialog", { name: "展位详情" })).toHaveCount(0);
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
  await searchFor(page, "W5A34");
  await searchResult(page, /A34/).click();
  await expect(page.getByRole("dialog", { name: "展位详情" })).toBeVisible();
  await page.mouse.move(10, 450);
  await page.mouse.down();
  await page.mouse.move(10, 490, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole("dialog", { name: "展位详情" })).toBeVisible();
  // A34 聚焦后 x=10 的地图边缘为展位外空白。
  const sheet = page.getByRole("dialog", { name: "展位详情" });
  await page.mouse.click(10, 450);
  await expect(sheet).toHaveAttribute("data-state", "closed");
  await expect(sheet).toHaveCount(0);
  await searchFor(page, "A28");
  const searchPanel = page.locator(".search-panel");
  await page.mouse.click(10, 450);
  await expect(searchPanel).toHaveCount(0);
  await expect(searchResults(page)).toHaveCount(0);
  await expect(page.getByRole("combobox")).toHaveCount(0);
});

test("详情仅从把手或标题上拉展开，展开后下拉关闭", async ({ page }) => {
  await page.setViewportSize({ width: 868, height: 456 });
  await page.goto("/");
  await searchFor(page, "W5A34");
  await searchResult(page, /A34/).click();
  const handle = page.locator(".sheet-handle");
  const toggle = page.getByRole("button", { name: "展开贴图" });
  await expect(handle).toBeVisible();
  await page.waitForTimeout(300);
  await handle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".photo-reveal")).toHaveAttribute("hidden", "until-found");
  await expect(page.getByRole("button", { name: "添加贴图" })).toHaveCount(0);
  const box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 20, { steps: 8 });
  // Slow release tests distance-based rebound, independent of flick velocity.
  await page.waitForTimeout(120);
  await page.mouse.up();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect
    .poll(async () => {
      return Math.round((await handle.boundingBox())!.y);
    })
    .toBe(Math.round(box.y));

  const description = page.locator(".booth-names");
  const descriptionBox = (await description.boundingBox())!;
  await page.mouse.move(
    descriptionBox.x + descriptionBox.width / 2,
    descriptionBox.y + descriptionBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    descriptionBox.x + descriptionBox.width / 2,
    descriptionBox.y + descriptionBox.height / 2 - 120,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x, y: y - 20 }],
  });
  await expect
    .poll(async () => {
      return (await handle.boundingBox())!.y;
    })
    .toBeLessThan(box.y - 10);

  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x, y: y - 60 }],
  });
  await expect(page.locator(".photo-reveal")).toHaveAttribute("data-state", "open");
  const revealMotion = await page.locator(".photo-reveal").evaluate((element) => {
    return {
      height: element.getBoundingClientRect().height,
      contentHeight: element.scrollHeight,
      transition: getComputedStyle(element).transitionProperty,
    };
  });
  expect(revealMotion.contentHeight).toBeGreaterThan(0);
  expect(revealMotion.height).toBeLessThan(revealMotion.contentHeight);
  expect(revealMotion.transition).toContain("height");
  const expandedWhileHeld = (await handle.boundingBox())!.y;
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x, y: y - 120 }],
  });
  await expect
    .poll(async () => {
      return (await handle.boundingBox())!.y;
    })
    .toBeLessThan(expandedWhileHeld - 30);

  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x, y: y - 220 }],
  });
  await handle.evaluate(() => {
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
  const fullyPulledY = (await handle.boundingBox())!.y;
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x, y: y - 260 }],
  });
  await expect
    .poll(async () => {
      return Math.abs((await handle.boundingBox())!.y - fullyPulledY);
    })
    .toBeLessThan(1.5);

  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.getByRole("button", { name: "收起贴图" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.getByRole("button", { name: "添加贴图" })).toBeVisible();

  const expandedHandleBox = (await handle.boundingBox())!;
  const expandedX = expandedHandleBox.x + expandedHandleBox.width / 2;
  const expandedY = expandedHandleBox.y + expandedHandleBox.height / 2;
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: expandedX, y: expandedY }],
  });
  for (let distance = 20; distance <= 100; distance += 20) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: expandedX, y: expandedY + distance }],
    });
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.getByRole("dialog", { name: "展位详情" })).toHaveCount(0);
  await session.detach();
});

test("贴图收起后的下拉关闭匹配距离、速度和反向取消规则", async ({ page }) => {
  await page.goto("/");
  await searchFor(page, "W5A34");
  await searchResult(page, /A34/).click();
  await page.getByRole("button", { name: "展开贴图" }).click();
  await page.getByRole("button", { name: "收起贴图" }).click();
  await page.waitForTimeout(300);

  const handle = page.locator(".sheet-handle");
  const box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 20, { steps: 4 });
  await page.waitForTimeout(120);
  await page.mouse.up();
  await expect(page.getByRole("dialog", { name: "展位详情" })).toBeVisible();
  await expect
    .poll(async () => {
      return Math.round((await handle.boundingBox())!.y);
    })
    .toBe(Math.round(box.y));

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 60, { steps: 4 });
  await page.mouse.move(x, y + 45, { steps: 2 });
  await page.mouse.up();
  await expect(page.getByRole("dialog", { name: "展位详情" })).toBeVisible();
  await expect
    .poll(async () => {
      return Math.round((await handle.boundingBox())!.y);
    })
    .toBe(Math.round(box.y));

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 5);
  await page.mouse.move(x, y + 30);
  await page.mouse.up();
  await expect(page.getByRole("dialog", { name: "展位详情" })).toHaveCount(0);
});

test("搜索条与列表围绕搜索图标收拢，列表宽度保持稳定", async ({ page }) => {
  await page.goto("/");
  await searchFor(page, "A34");
  const panel = page.locator(".search-panel");
  const resultList = page.locator(".search-result-list");
  const firstResult = searchResults(page).getByRole("option").first();
  await expect(searchResults(page)).toBeVisible();
  await expect(resultList).toHaveCSS("list-style-type", "none");
  await expect(resultList).toHaveCSS("padding-left", "0px");
  await expect(firstResult).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
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

test("搜索结果使用图标并在可滚动边缘渐隐", async ({ page }) => {
  await page.goto("/");
  await searchFor(page, "海");
  const resultList = page.locator(".search-result-list");
  const firstResult = searchResults(page).getByRole("option").first();

  await expect(firstResult.locator("svg.result-arrow")).toBeVisible();
  await expect(resultList).toHaveClass(/has-overflow-below/);
  await expect(resultList).not.toHaveClass(/has-overflow-above/);
  await expect
    .poll(async () => {
      return resultList.evaluate((element) => {
        return getComputedStyle(element).maskImage;
      });
    })
    .not.toBe("none");

  await resultList.evaluate((element) => {
    element.scrollTop = (element.scrollHeight - element.clientHeight) / 2;
    element.dispatchEvent(new Event("scroll"));
  });
  await expect(resultList).toHaveClass(/has-overflow-above/);
  await expect(resultList).toHaveClass(/has-overflow-below/);

  await resultList.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event("scroll"));
  });
  await expect(resultList).toHaveClass(/has-overflow-above/);
  await expect(resultList).not.toHaveClass(/has-overflow-below/);
});

test("清除搜索内容后输入框保持聚焦", async ({ page }) => {
  await page.goto("/");
  await searchFor(page, "海洋堂");
  const input = page.getByRole("combobox", { name: "搜索展商或展位号" });
  const clear = page.getByRole("button", { name: "清除搜索内容", exact: true });

  await expect(clear).toBeVisible();
  await clear.click();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  await expect(clear).toHaveCount(0);
  await expect(searchResults(page)).toContainText("输入展商名称");
});

test("窄屏与 700px 断点两侧的浮层都保持在可视区域内", async ({ page }) => {
  for (const width of [360, 699]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    const hallSwitcher = (await page.getByRole("group", { name: "展馆选择" }).boundingBox())!;
    expect(hallSwitcher.x).toBeGreaterThanOrEqual(12);
    expect(hallSwitcher.x + hallSwitcher.width).toBeLessThanOrEqual(width - 12);
    expect(hallSwitcher.y).toBeGreaterThan(700);
  }

  await page.setViewportSize({ width: 700, height: 800 });
  await expect
    .poll(async () => {
      return Math.round((await page.getByRole("group", { name: "展馆选择" }).boundingBox())!.y);
    })
    .toBe(20);
  const hallSwitcher = (await page.getByRole("group", { name: "展馆选择" }).boundingBox())!;
  expect(hallSwitcher.x + hallSwitcher.width).toBeLessThanOrEqual(680);
  await searchFor(page, "A34");
  const results = (await searchResults(page).boundingBox())!;
  expect(results.x).toBeGreaterThanOrEqual(12);
  expect(results.x + results.width).toBeLessThanOrEqual(452);
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
