import type { Page } from "@playwright/test";

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState("networkidle");
  }

  async getTitle(): Promise<string> {
    return this.page.title();
  }

  async getCurrentUrl(): Promise<string> {
    return this.page.url();
  }

  async waitForUrl(expectedUrl: string | RegExp): Promise<void> {
    await this.page.waitForURL(expectedUrl);
  }

  async refresh(): Promise<void> {
    await this.page.reload();
  }

  async waitForSelector(selector: string, timeout = 10000): Promise<void> {
    await this.page.waitForSelector(selector, { timeout });
  }

  async isVisible(selector: string): Promise<boolean> {
    return this.page.locator(selector).isVisible();
  }

  async containsText(text: string): Promise<boolean> {
    return this.page.locator(`text=${text}`).isVisible();
  }

  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `test-results/screenshots/${name}.png` });
  }

  async isOnline(): Promise<boolean> {
    return this.page.evaluate(() => navigator.onLine);
  }

  async setOffline(): Promise<void> {
    await this.page.context().setOffline(true);
  }

  async setOnline(): Promise<void> {
    await this.page.context().setOffline(false);
  }
}
