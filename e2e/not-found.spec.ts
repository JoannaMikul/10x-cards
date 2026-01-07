import { test, expect } from "@playwright/test";
import { LoginPage } from "./page-objects";

test.describe("404 Not Found Page", () => {
  test("should show 404 page for non-existent routes when not logged in", async ({ page }) => {
    await page.goto("/non-existent-page-random-123");

    expect(page.url()).toContain("/non-existent-page-random-123");

    await expect(page.getByRole("heading", { name: "Page Not Found" })).toBeVisible();
    await expect(page.getByText("It looks like the page you're looking for doesn't exist")).toBeVisible();

    await expect(page.getByAltText("Illustration showing navigation error - lost astronaut")).toBeVisible();

    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Flashcard Generator" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Your Flashcards" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Page Not Found" })).toBeFocused();
  });

  test("should redirect to login for protected routes even if they don't exist", async ({ page }) => {
    await page.goto("/flashcards/some-random-id");

    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("should show 404 page for non-existent routes when logged in", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    const username = process.env.E2E_USERNAME ?? "";
    const password = process.env.E2E_PASSWORD ?? "";

    if (!username || !password) {
      test.skip(true, "E2E credentials not provided");
      return;
    }

    await loginPage.fillEmail(username);
    await loginPage.fillPassword(password);
    await loginPage.clickSignIn();

    await expect(page.getByText("Welcome to 10x-cards")).toBeVisible({ timeout: 15000 });

    await page.goto("/another-non-existent-page");

    await expect(page.getByRole("heading", { name: "Page Not Found" })).toBeVisible();

    // Clicking Home link should redirect to login since user is not logged in on 404 page
    await page.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
