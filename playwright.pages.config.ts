import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests-pages",
  use: {
    baseURL: "http://127.0.0.1:4175",
    ...devices["Desktop Chrome"],
    channel: process.env.CI ? undefined : "chrome",
  },
  webServer: {
    command: "VITE_WF_PAGES=1 vp run preview --port 4175",
    url: "http://127.0.0.1:4175/wf-map/",
    reuseExistingServer: !process.env.CI,
  },
});
