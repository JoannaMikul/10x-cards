import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";

export class HomePage extends BasePage {
  readonly mainNavigation: Locator;
  readonly pageTitle: Locator;
  readonly heroSection: Locator;

  constructor(page: Page) {
    super(page);

    this.mainNavigation = page.locator("nav");
    this.pageTitle = page.locator("h1");
    this.heroSection = page.locator('[data-testid="hero-section"]');
  }

  async goto(): Promise<void> {
    await this.page.goto("/");
  }

  async isLoaded(): Promise<boolean> {
    await this.page.waitForLoadState("networkidle");
    return this.mainNavigation.isVisible();
  }

  async isNavigationVisible(): Promise<boolean> {
    return this.mainNavigation.isVisible();
  }

  async hasCorrectTitle(): Promise<boolean> {
    const title = await this.getTitle();
    return title.includes("10x-cards");
  }
}
