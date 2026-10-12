import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const screenshotsDir = path.resolve(__dirname, "../screenshots");

async function saveScreenshot(page: Page, name: string) {
  mkdirSync(screenshotsDir, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotsDir, name),
    fullPage: true,
  });
}

test("overview shows the Devnet and mainnet board", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ValueCurator", exact: true })).toBeVisible();
  await expect(page.getByText("Program on Devnet. AAPLx evidence is a mainnet read.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Rejected operator/ })).toBeVisible();
  await saveScreenshot(page, "01-overview.png");
});

test("mandate view shows the draft limits", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Mandate: Configure execution policy" }).click();
  await expect(page.getByRole("heading", { name: "Configure Execution Mandate" })).toBeVisible();
  await saveScreenshot(page, "02-mandate.png");
});

test("gate blocks a stale price without submitting a transaction", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Gate: Evidence and decision" }).click();
  await page.getByRole("button", { name: "Block · stale price" }).click();
  await expect(page.getByText("transaction submitted: no").first()).toBeVisible();
  await expect(page.getByText("CONTROLLED SIMULATION")).toBeVisible();
  await saveScreenshot(page, "03-gate-stale.png");
});

test("audit view lists the Devnet custody signatures", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Audit: Reports and history" }).click();
  await expect(page.getByRole("heading", { name: "Custody signatures" })).toBeVisible();
  await expect(page.getByText("metabolize_yield").first()).toBeVisible();
  await saveScreenshot(page, "04-audit.png");
});

test("subscription screen shows the illustrative monthly amount", async ({ page }) => {
  await page.goto("/subscribe");
  await expect(page.getByRole("heading", { name: "One month of the lock" })).toBeVisible();
  await expect(page.getByText("1 USDC").first()).toBeVisible();
  await saveScreenshot(page, "05-subscribe.png");
});
