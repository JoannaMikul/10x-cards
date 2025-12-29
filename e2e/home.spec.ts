import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("should load home page successfully", async ({ page }) => {
    await page.goto("/");

    // Check if the page title exists
    await expect(page).toHaveTitle(/10x-cards/);
  });

  test("should have main navigation", async ({ page }) => {
    await page.goto("/");

    // Check for main navigation elements
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();
  });
});
