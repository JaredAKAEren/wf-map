import { expect, test, type Page } from "@playwright/test";

interface PhotoHarness {
  rows: { uri: string; boothId: string; createdAt: number }[];
  picked: string[];
  delays: Record<string, number>;
  failure: string;
  calls: { method: string; options: Record<string, unknown> }[];
}

declare global {
  interface Window {
    photoHarness: PhotoHarness;
  }
}

async function prepare(page: Page, count = 2) {
  await page.addInitScript((initialCount) => {
    const state: PhotoHarness = {
      rows: Array.from({ length: initialCount }, (_, index) => {
        return {
          uri: `content://image-${index}`,
          boothId: "wf2026/W5/A34",
          createdAt: index,
        };
      }),
      picked: ["content://new-image"],
      delays: {},
      failure: "",
      calls: [],
    };
    window.photoHarness = state;
    Reflect.set(window, "androidBridge", {});
    Reflect.set(window, "Capacitor", {
      PluginHeaders: [
        {
          name: "Preferences",
          methods: ["get", "set"].map((name) => {
            return { name, rtype: "promise" };
          }),
        },
        {
          name: "ExhibitionPhotos",
          methods: [
            "pick",
            "list",
            "listBooths",
            "assign",
            "thumbnail",
            "open",
            "remove",
            "releaseUnlinked",
          ].map((name) => {
            return { name, rtype: "promise" };
          }),
        },
      ],
      async nativePromise(plugin: string, method: string, options: Record<string, unknown> = {}) {
        if (plugin === "Preferences") {
          return method === "get" ? { value: null } : undefined;
        }

        state.calls.push({ method, options });
        const snapshot = state.rows.filter((row) => {
          return row.boothId === options.boothId;
        });
        snapshot.sort((left, right) => {
          return right.createdAt - left.createdAt;
        });
        const picked = [...state.picked];
        if (state.delays[method]) {
          await new Promise((resolve) => {
            return setTimeout(resolve, state.delays[method]);
          });
        }
        if (
          state.failure === method ||
          (options.uri === "content://unavailable" && method !== "remove")
        ) {
          throw new Error("fixture failure");
        }
        switch (method) {
          case "pick":
            return { uris: picked, failed: 0 };
          case "listBooths":
            return {
              boothIds: [
                ...new Set(
                  state.rows.map((row) => {
                    return row.boothId;
                  }),
                ),
              ],
            };
          case "list":
            return { photos: snapshot };
          case "assign": {
            const previous = state.rows.find((row) => {
              return row.uri === options.uri;
            });
            if (previous && previous.boothId !== options.boothId && !options.replace) {
              return { conflict: previous.boothId };
            }
            if (previous) {
              previous.boothId = String(options.boothId);
            } else {
              state.rows.unshift({
                uri: String(options.uri),
                boothId: String(options.boothId),
                createdAt: Date.now(),
              });
            }
            return {};
          }
          case "remove":
            state.rows = state.rows.filter((row) => {
              return row.uri !== options.uri;
            });
            return undefined;
          case "thumbnail": {
            const canvas = document.createElement("canvas");
            canvas.width = 80;
            canvas.height = 80;
            const context = canvas.getContext("2d")!;
            context.fillStyle = options.uri === "content://new-image" ? "#57988b" : "#f4980f";
            context.fillRect(0, 0, 80, 80);
            context.fillStyle = "#ffffff";
            context.fillRect(20, 20, 40, 40);
            return { dataUrl: canvas.toDataURL() };
          }
          default:
            return undefined;
        }
      },
    });
  }, count);
  await page.goto("/");
}

async function choose(page: Page, code = "A34") {
  await page.getByRole("button", { name: "搜索展商或展位", exact: true }).click();
  await page.getByRole("combobox").fill(code);
  await page
    .getByRole("option", { name: new RegExp(code) })
    .first()
    .click();
  await page.getByRole("button", { name: "展开贴图" }).click();
  await expect(page.locator(".photo-reveal")).toHaveAttribute("data-state", "open");
}

async function settled(page: Page) {
  await expect(page.getByRole("button", { name: "添加贴图" })).toBeEnabled();
  await page.locator(".booth-sheet").evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .filter((animation) => {
          return animation.effect?.getTiming().iterations !== Infinity;
        })
        .map((animation) => {
          return animation.finished.catch(() => {});
        }),
    );
  });
}

async function openMenu(page: Page) {
  await page.getByRole("button", { name: "查看原图" }).first().click({ button: "right" });
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  // Reka 在挂载后的下一轮事件循环注册外部点击；等覆盖层完成首帧再操作。
  await menu.evaluate(() => {
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
  });
}

async function sampleHeight(page: Page, button: string) {
  return page.evaluate(async (selector) => {
    const sheet = document.querySelector<HTMLElement>(".booth-sheet")!;
    const heights = [sheet.getBoundingClientRect().height];
    document.querySelector<HTMLButtonElement>(selector)!.click();
    const start = performance.now();
    await new Promise<void>((resolve) => {
      function frame() {
        heights.push(sheet.getBoundingClientRect().height);
        if (performance.now() - start < 450) {
          requestAnimationFrame(frame);
        } else {
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
    return heights;
  }, button);
}

async function sampleGrid(page: Page, button: string) {
  return page.evaluate(async (selector) => {
    const grid = document.querySelector<HTMLElement>(".photo-grid")!;
    const original = [...grid.children];

    function snapshot() {
      const origin = grid.getBoundingClientRect();

      function measure(element: Element) {
        const box = element.getBoundingClientRect();

        return {
          x: box.x - origin.x,
          centerX: box.x + box.width / 2 - origin.x,
          centerY: box.y + box.height / 2 - origin.y,
          opacity: Number(getComputedStyle(element).opacity),
          connected: element.isConnected,
        };
      }

      return {
        original: original.map(measure),
        added: [...grid.children]
          .filter((element) => {
            return !original.includes(element);
          })
          .map(measure),
      };
    }

    const frames = [snapshot()];
    document.querySelector<HTMLButtonElement>(selector)!.click();
    const start = performance.now();
    await new Promise<void>((resolve) => {
      function frame() {
        frames.push(snapshot());
        if (performance.now() - start < 450) {
          requestAnimationFrame(frame);
        } else {
          resolve();
        }
      }

      requestAnimationFrame(frame);
    });

    return frames;
  }, button);
}

function expectIntermediate(heights: number[]) {
  const low = Math.min(...heights);
  const high = Math.max(...heights);
  expect(high - low).toBeGreaterThan(20);
  expect(
    heights.some((height) => {
      return height > low + 3 && height < high - 3;
    }),
  ).toBe(true);
}

test("移动端展开动画抑制 click 时仍从 pointerup 打开原生图片选择器", async ({ page }) => {
  await prepare(page, 0);
  await choose(page);

  const button = page.getByRole("button", { name: "添加贴图" });
  await button.dispatchEvent("pointerdown", {
    button: 0,
    clientX: 40,
    clientY: 40,
    isPrimary: true,
    pointerId: 1,
  });
  await button.dispatchEvent("pointerup", {
    button: 0,
    clientX: 40,
    clientY: 40,
    isPrimary: true,
    pointerId: 1,
  });
  await expect
    .poll(() => {
      return page.evaluate(() => {
        return window.photoHarness.calls.filter((call) => {
          return call.method === "pick";
        }).length;
      });
    })
    .toBe(1);
});

test("展开收起和增删跨行均有高度中间帧，已有缩略图不重建", async ({ page }) => {
  await prepare(page);
  await choose(page);
  await settled(page);
  const image = page.locator(".photo-preview img").first();
  await image.evaluate((element) => {
    return element.setAttribute("data-retained", "true");
  });
  expectIntermediate(await sampleHeight(page, ".details-link"));
  expectIntermediate(await sampleHeight(page, ".details-link"));
  expectIntermediate(await sampleHeight(page, ".add-photo"));
  await settled(page);
  await expect(page.locator(".photo-preview img[data-retained='true']")).toHaveCount(1);
  expect(
    await page.evaluate(() => {
      return window.photoHarness.calls.filter((call) => {
        return call.method === "thumbnail";
      }).length;
    }),
  ).toBe(3);
  await page.getByRole("button", { name: "查看原图" }).last().click({ button: "right" });
  await page.locator(".remove-button").dispatchEvent("pointerdown");
  expectIntermediate(await sampleHeight(page, ".remove-button"));
  await expect(page.getByRole("button", { name: "查看原图" })).toHaveCount(2);
  await expect(page.locator(".photo-preview img[data-retained='true']")).toHaveCount(1);
  await page.evaluate(() => {
    window.photoHarness.delays.pick = 500;
    window.photoHarness.picked = ["content://while-collapsed"];
  });
  await page.getByRole("button", { name: "添加贴图" }).click();
  await page.getByRole("button", { name: "收起贴图" }).click();
  await expect
    .poll(() => {
      return page.evaluate(() => {
        return window.photoHarness.rows.length;
      });
    })
    .toBe(3);
  const reopened = await sampleHeight(page, ".details-link");
  const largestStep = Math.max(
    ...reopened.slice(1).map((height, index) => {
      return Math.abs(height - reopened[index]!);
    }),
  );
  expect(largestStep).toBeLessThan((Math.max(...reopened) - Math.min(...reopened)) * 0.3);
});

test("新增图片追加在末尾，重复选择及重新打开不改变原有顺序", async ({ page }) => {
  await prepare(page);
  await choose(page);
  await settled(page);
  await page.getByRole("button", { name: "添加贴图" }).click();
  await settled(page);
  for (const tile of await page.getByRole("button", { name: "查看原图" }).all()) {
    await tile.click();
  }
  expect(
    await page.evaluate(() => {
      return window.photoHarness.calls
        .filter((call) => {
          return call.method === "open";
        })
        .map((call) => {
          return call.options.uri;
        });
    }),
  ).toEqual(["content://image-0", "content://image-1", "content://new-image"]);
  await page.evaluate(() => {
    window.photoHarness.picked = ["content://image-0", "content://another-image"];
    window.photoHarness.calls = [];
  });
  await page.getByRole("button", { name: "添加贴图" }).click();
  await settled(page);
  await choose(page);
  await settled(page);
  await expect(page.getByRole("button", { name: "查看原图" })).toHaveCount(4);
  for (const tile of await page.getByRole("button", { name: "查看原图" }).all()) {
    await tile.click();
  }
  expect(
    await page.evaluate(() => {
      return window.photoHarness.calls
        .filter((call) => {
          return call.method === "open";
        })
        .map((call) => {
          return call.options.uri;
        });
    }),
  ).toEqual([
    "content://image-0",
    "content://image-1",
    "content://new-image",
    "content://another-image",
  ]);
});

for (const reduced of [false, true]) {
  test(`图片进出和跨行补位${reduced ? "遵循减少动态效果" : "均有过渡中间帧"}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
    await prepare(page);
    await choose(page);
    await settled(page);
    const insertion = await sampleGrid(page, ".add-photo");
    const addStart = insertion[0]!.original[2]!.x;
    expect(
      insertion.some((frame) => {
        return frame.added.some((tile) => {
          return tile.opacity > 0.01 && tile.opacity < 0.99;
        });
      }),
    ).toBe(!reduced);
    expect(
      insertion.some((frame) => {
        return frame.original[2]!.x > 1 && frame.original[2]!.x < addStart - 1;
      }),
    ).toBe(!reduced);
    await settled(page);
    await openMenu(page);
    await page.locator(".remove-button").dispatchEvent("pointerdown");
    const removal = await sampleGrid(page, ".remove-button");
    const movingStart = removal[0]!.original[1]!.x;
    expect(
      removal.some((frame) => {
        return frame.original[0]!.opacity > 0.01 && frame.original[0]!.opacity < 0.99;
      }),
    ).toBe(!reduced);
    expect(
      removal.some((frame) => {
        return frame.original[1]!.x > 1 && frame.original[1]!.x < movingStart - 1;
      }),
    ).toBe(!reduced);
    const leaving = removal[0]!.original[0]!;
    for (const frame of removal) {
      const tile = frame.original[0]!;
      if (tile.connected) {
        expect(Math.abs(tile.centerX - leaving.centerX)).toBeLessThan(1);
        expect(Math.abs(tile.centerY - leaving.centerY)).toBeLessThan(1);
      }
    }
    await expect(page.getByRole("button", { name: "查看原图" })).toHaveCount(2);
    await expect(page.locator(".photo-item[inert]")).toHaveCount(0);
  });
}

test("慢加载延迟显示 icon，快速添加不闪现，图片完成后淡入", async ({ page }) => {
  await prepare(page, 0);
  await choose(page);
  await settled(page);
  await page.evaluate(() => {
    window.photoHarness.delays.thumbnail = 1200;
  });
  await page.getByRole("button", { name: "添加贴图" }).click();
  const spinner = page.locator(".photo-preview .loading-icon");
  await expect(spinner).toHaveCount(0);
  await expect
    .poll(
      () => {
        return spinner.evaluate((element) => {
          return Number(getComputedStyle(element).opacity);
        });
      },
      { intervals: [20] },
    )
    .toBeGreaterThan(0.8);
  await expect(page.getByRole("img", { name: "展位贴图缩略图" })).toHaveCSS("opacity", "1");
  await settled(page);
  await page.evaluate(() => {
    window.photoHarness.delays.thumbnail = 0;
    window.photoHarness.picked = ["content://fast-image"];
  });
  const { opacities, imageOpacities } = await page.evaluate(async () => {
    const values: number[] = [];
    const imageValues: number[] = [];
    document.querySelector<HTMLButtonElement>(".add-photo")!.click();
    const start = performance.now();
    await new Promise<void>((resolve) => {
      function frame() {
        document.querySelectorAll(".loading-icon").forEach((element) => {
          return values.push(Number(getComputedStyle(element).opacity));
        });
        const image = document.querySelector(".photo-item:last-of-type img.loaded");
        if (image) {
          imageValues.push(Number(getComputedStyle(image).opacity));
        }
        if (performance.now() - start < 450) {
          requestAnimationFrame(frame);
        } else {
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
    return { opacities: values, imageOpacities: imageValues };
  });
  expect(
    opacities.every((opacity) => {
      return opacity === 0;
    }),
  ).toBe(true);
  expect(
    imageOpacities.some((opacity) => {
      return opacity > 0 && opacity < 1;
    }),
  ).toBe(true);
  await expect(page.getByRole("img", { name: "展位贴图缩略图" })).toHaveCount(2);
});

test("长按覆盖当前图片，松手不解除，点外部只关闭覆盖层", async ({ page }) => {
  await prepare(page);
  await choose(page);
  await settled(page);
  await page.screenshot({ path: test.info().outputPath("stickers-mobile.png") });
  const tile = page.getByRole("button", { name: "查看原图" }).first();
  const box = (await tile.boundingBox())!;
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
  });
  await expect(page.getByRole("menuitem", { name: "解除关联" })).toBeVisible();
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.getByRole("menuitem", { name: "解除关联" })).toBeVisible();
  expect(
    await page.evaluate(() => {
      return window.photoHarness.calls.filter((call) => {
        return ["open", "remove"].includes(call.method);
      });
    }),
  ).toEqual([]);
  const overlay = (await page.locator(".photo-actions").boundingBox())!;
  expect(Math.abs(overlay.x - box.x)).toBeLessThan(1);
  expect(Math.abs(overlay.y - box.y)).toBeLessThan(1);
  expect(Math.abs(overlay.width - box.width)).toBeLessThan(1);
  await page.screenshot({ path: test.info().outputPath("stickers-menu.png") });
  await page.touchscreen.tap(10, 450);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "展位详情" })).toBeVisible();
  await tile.click();
  expect(
    await page.evaluate(() => {
      return window.photoHarness.calls.filter((call) => {
        return call.method === "open";
      }).length;
    }),
  ).toBe(1);
  await tile.click({ button: "right" });
  await page.getByRole("menuitem", { name: "解除关联" }).click();
  await expect(page.getByRole("button", { name: "查看原图" })).toHaveCount(1);
  await session.detach();
});

test("解除失败保留原图及记录，重新操作可成功", async ({ page }) => {
  await prepare(page);
  await choose(page);
  await settled(page);
  await page.evaluate(() => {
    window.photoHarness.failure = "remove";
  });
  const tile = page.getByRole("button", { name: "查看原图" }).first();
  await tile.click({ button: "right" });
  await page.getByRole("menuitem", { name: "解除关联" }).click();
  await expect(page.locator(".notice")).toContainText("解除关联失败");
  await settled(page);
  await expect(page.getByRole("img", { name: "展位贴图缩略图" })).toHaveCount(2);
  await page.evaluate(() => {
    window.photoHarness.failure = "";
  });
  await tile.click({ button: "right" });
  await page.getByRole("menuitem", { name: "解除关联" }).click();
  await expect(page.getByRole("button", { name: "查看原图" })).toHaveCount(1);
});

test("覆盖层拦截其他图片点击，键盘可展开贴图并解除关联", async ({ page }) => {
  await prepare(page);
  await choose(page);
  await settled(page);
  const tiles = page.getByRole("button", { name: "查看原图" });
  await openMenu(page);
  const other = (await page.locator(".photo-preview").last().boundingBox())!;
  await page.touchscreen.tap(other.x + other.width / 2, other.y + other.height / 2);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "展位详情" })).toBeVisible();
  await expect(tiles.first()).toBeFocused();
  expect(
    await page.evaluate(() => {
      return window.photoHarness.calls.filter((call) => {
        return call.method === "open";
      });
    }),
  ).toEqual([]);
  await page.getByRole("button", { name: "收起贴图" }).press("Space");
  await expect(page.getByRole("button", { name: "展开贴图" })).toBeFocused();
  await page.keyboard.press("Enter");
  await settled(page);
  for (const key of ["Enter", "Space"]) {
    const remaining = await tiles.count();
    await openMenu(page);
    await page.getByRole("menuitem", { name: "解除关联" }).press(key);
    await expect(tiles).toHaveCount(remaining - 1);
    await settled(page);
  }
});

test("覆盖层打开时点击搜索只关闭覆盖层", async ({ page }) => {
  await prepare(page);
  await choose(page);
  await settled(page);
  const search = (await page.getByRole("button", { name: "搜索展商或展位" }).boundingBox())!;
  await openMenu(page);
  await page.mouse.click(search.x + search.width / 2, search.y + search.height / 2);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "展位详情" })).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveCount(0);
});

test("旧列表晚返回不覆盖新展位，桌面面板保持 520px", async ({ page }) => {
  await prepare(page);
  await page.setViewportSize({ width: 960, height: 900 });
  await page.evaluate(() => {
    window.photoHarness.delays.list = 1200;
  });
  await choose(page);
  await page.evaluate(() => {
    window.photoHarness.delays.list = 0;
    window.photoHarness.rows.push({
      uri: "content://other-booth",
      boothId: "wf2026/W5/A28",
      createdAt: 1,
    });
  });
  await choose(page, "A28");
  await settled(page);
  await page.waitForTimeout(1250);
  await expect(page.getByRole("button", { name: "查看原图" })).toHaveCount(1);
  await expect(page.locator(".sheet-heading")).toContainText("A28");
  expect((await page.locator(".booth-sheet").boundingBox())!.width).toBe(520);
  await page.screenshot({ path: test.info().outputPath("stickers-desktop.png") });
});

test("失效图片仍可解除，收起后保留缩略图且不参与键盘焦点", async ({ page }) => {
  await prepare(page, 0);
  await page.evaluate(() => {
    window.photoHarness.rows = [
      { uri: "content://unavailable", boothId: "wf2026/W5/A34", createdAt: 1 },
    ];
  });
  await choose(page);
  await expect(page.getByText("原图不可访问", { exact: true })).toBeVisible();
  await settled(page);
  const tile = page.getByRole("button", { name: "查看原图" });
  await tile.click({ button: "right", force: true });
  await expect(page.getByRole("menuitem", { name: "解除关联" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "展位详情" })).toBeVisible();
  await page.getByRole("button", { name: "收起贴图" }).click();
  await expect(page.getByRole("button", { name: "添加贴图" })).toHaveCount(0);
  await page.keyboard.press("Tab");
  expect(
    await page.locator(".photos").evaluate((element) => {
      return element.contains(document.activeElement);
    }),
  ).toBe(false);
  await page.getByRole("button", { name: "展开贴图" }).click();
  await settled(page);
  await tile.click({ button: "right", force: true });
  await page.getByRole("menuitem", { name: "解除关联" }).click();
  await expect(page.getByRole("button", { name: "查看原图" })).toHaveCount(0);
});

test("选择器返回前切换展位，不关联到旧展位或污染新列表", async ({ page }) => {
  await prepare(page);
  await choose(page);
  await settled(page);
  await page.evaluate(() => {
    window.photoHarness.delays.pick = 700;
  });
  await page.getByRole("button", { name: "添加贴图" }).click();
  await choose(page, "A28");
  await expect
    .poll(() => {
      return page.evaluate(() => {
        return window.photoHarness.calls.filter((call) => {
          return call.method === "releaseUnlinked";
        }).length;
      });
    })
    .toBe(1);
  expect(
    await page.evaluate(() => {
      return window.photoHarness.calls.filter((call) => {
        return call.method === "assign";
      });
    }),
  ).toEqual([]);
  await expect(page.getByRole("button", { name: "查看原图" })).toHaveCount(0);
});

test("关闭动画保留展位，选择器晚返回仅释放未关联授权", async ({ page }) => {
  await prepare(page);
  await choose(page);
  await settled(page);
  await page.evaluate(() => {
    window.photoHarness.delays.pick = 700;
  });
  await page.getByRole("button", { name: "添加贴图" }).click();
  await page.mouse.click(10, 450);
  const sheet = page.locator(".booth-sheet");
  await expect(sheet).toHaveAttribute("data-state", "closed");
  expect(
    await sheet.evaluate((element) => {
      return {
        state: element.getAttribute("data-state"),
        inert: element.hasAttribute("inert"),
        code: element.querySelector(".sheet-code")?.textContent,
      };
    }),
  ).toEqual({ state: "closed", inert: true, code: "A34" });
  await expect(sheet).toHaveCount(0);
  await expect
    .poll(() => {
      return page.evaluate(() => {
        return window.photoHarness.calls.filter((call) => {
          return call.method === "releaseUnlinked";
        });
      });
    })
    .toEqual([{ method: "releaseUnlinked", options: { uris: ["content://new-image"] } }]);
  expect(
    await page.evaluate(() => {
      return window.photoHarness.calls.filter((call) => {
        return call.method === "assign";
      });
    }),
  ).toEqual([]);
  await choose(page);
  await settled(page);
  await expect(page.getByRole("button", { name: "查看原图" })).toHaveCount(2);
});

test("切换展位忽略旧缩略图请求，重新打开读取当前记录", async ({ page }) => {
  await prepare(page);
  await page.evaluate(() => {
    window.photoHarness.delays.thumbnail = 700;
  });
  await choose(page);
  await expect(page.getByRole("button", { name: "查看原图" })).toHaveCount(2);
  await choose(page, "A28");
  await settled(page);
  await page.waitForTimeout(750);
  await expect(page.getByRole("button", { name: "查看原图" })).toHaveCount(0);
  await page.evaluate(() => {
    window.photoHarness.delays.thumbnail = 0;
  });
  await choose(page);
  await settled(page);
  await expect(page.getByRole("img", { name: "展位贴图缩略图" })).toHaveCount(2);
});

test("窄屏多图限高可滚动，减少动态效果直接到位", async ({ page }) => {
  await prepare(page, 18);
  await page.setViewportSize({ width: 320, height: 760 });
  await choose(page);
  await settled(page);
  const sheet = page.locator(".booth-sheet");
  expect((await sheet.boundingBox())!.height).toBeLessThanOrEqual(760 * 0.65 + 1);
  const preview = (await page.locator(".photo-preview").first().boundingBox())!;
  const session = await page.context().newCDPSession(page);
  const x = preview.x + preview.width / 2;
  const y = preview.y + preview.height / 2;
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let distance = 20; distance <= 160; distance += 20) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y - distance }],
    });
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect
    .poll(() => {
      return sheet.evaluate((element) => {
        return element.scrollTop;
      });
    })
    .toBeGreaterThan(0);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await session.detach();
  await page.screenshot({ path: test.info().outputPath("stickers-narrow-scroll.png") });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await sheet.evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.getByRole("button", { name: "收起贴图" }).click();
  await expect(page.locator(".photo-reveal")).toHaveAttribute("hidden", "until-found");
  await expect(sheet).toHaveCSS("transition-duration", "1e-05s");
});
