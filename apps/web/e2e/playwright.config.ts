import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const e2eDir = __dirname;

export default defineConfig({
  testDir: path.join(e2eDir, "tests"),
  outputDir: path.join(e2eDir, "test-results"),
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: path.join(e2eDir, "playwright-report") }],
  ],
  use: {
    baseURL: "http://127.0.0.1:43147",
    screenshot: "on",
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
