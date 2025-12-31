import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";

export class ConfirmDialog extends BasePage {
  readonly confirmDialog: Locator;
  readonly confirmDialogTitle: Locator;
  readonly confirmCancelButton: Locator;
  readonly confirmActionButton: Locator;

  constructor(page: Page) {
    super(page);

    this.confirmDialog = page.getByTestId("confirm-dialog");
    this.confirmDialogTitle = page.getByTestId("confirm-dialog-title");
    this.confirmCancelButton = page.getByTestId("confirm-cancel-button");
    this.confirmActionButton = page.getByTestId("confirm-action-button");
  }

  async isVisible(): Promise<boolean> {
    return this.confirmDialog.isVisible();
  }

  async waitForVisible(timeout = 10000): Promise<void> {
    await this.page.waitForSelector('[data-testid="confirm-dialog"][data-state="open"]', { timeout });
  }

  async getTitle(): Promise<string> {
    const title = await this.confirmDialogTitle.textContent();
    return title || "";
  }

  async isDeleteDialog(): Promise<boolean> {
    const title = await this.getTitle();
    return title?.includes("Delete") || false;
  }

  async isRestoreDialog(): Promise<boolean> {
    const title = await this.getTitle();
    return title?.includes("Restore") || false;
  }

  async clickCancel(): Promise<void> {
    await this.confirmCancelButton.click();
  }

  async clickConfirm(): Promise<void> {
    await this.confirmActionButton.click();
  }

  async confirmAction(): Promise<void> {
    await this.clickConfirm();
  }

  async cancelAction(): Promise<void> {
    await this.clickCancel();
  }

  async isConfirmEnabled(): Promise<boolean> {
    return this.confirmActionButton.isEnabled();
  }

  async isLoading(): Promise<boolean> {
    const buttonText = await this.confirmActionButton.textContent();
    return buttonText?.includes("Processing") || false;
  }

  async getActionButtonText(): Promise<string | null> {
    return this.confirmActionButton.textContent();
  }

  async waitForDialogToClose(): Promise<void> {
    await this.confirmDialog.waitFor({ state: "hidden" });
  }

  async confirmDelete(): Promise<void> {
    if (await this.isDeleteDialog()) {
      await this.confirmAction();
      await this.waitForDialogToClose();
    }
  }

  async confirmRestore(): Promise<void> {
    if (await this.isRestoreDialog()) {
      await this.confirmAction();
      await this.waitForDialogToClose();
    }
  }

  async cancelDelete(): Promise<void> {
    if (await this.isDeleteDialog()) {
      await this.cancelAction();
      await this.waitForDialogToClose();
    }
  }

  async cancelRestore(): Promise<void> {
    if (await this.isRestoreDialog()) {
      await this.cancelAction();
      await this.waitForDialogToClose();
    }
  }
}
