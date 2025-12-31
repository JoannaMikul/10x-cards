import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";

export class FlashcardFormModal extends BasePage {
  readonly flashcardFormModal: Locator;
  readonly flashcardFormTitle: Locator;
  readonly flashcardForm: Locator;

  readonly frontTextarea: Locator;
  readonly backTextarea: Locator;
  readonly categorySelect: Locator;
  readonly categorySelectTrigger: Locator;
  readonly sourceSelect: Locator;
  readonly sourceSelectTrigger: Locator;

  readonly cancelButton: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);

    this.flashcardFormModal = page.getByTestId("flashcard-form-modal");
    this.flashcardFormTitle = page.getByTestId("flashcard-form-title");
    this.flashcardForm = page.getByTestId("flashcard-form");

    this.frontTextarea = page.getByTestId("front-textarea");
    this.backTextarea = page.getByTestId("back-textarea");
    this.categorySelect = page.getByTestId("category-select");
    this.categorySelectTrigger = page.getByTestId("category-select-trigger");
    this.sourceSelect = page.getByTestId("source-select");
    this.sourceSelectTrigger = page.getByTestId("source-select-trigger");

    this.cancelButton = page.getByTestId("cancel-button");
    this.submitButton = page.getByTestId("submit-button");
  }

  async isVisible(): Promise<boolean> {
    return this.flashcardFormModal.isVisible();
  }

  async waitForVisible(timeout = 10000): Promise<void> {
    await this.page.waitForSelector('[data-testid="flashcard-form-modal"][data-state="open"]', { timeout });
  }

  async getTitle(): Promise<string> {
    const title = await this.flashcardFormTitle.textContent();
    return title || "";
  }

  async fillFrontText(text: string): Promise<void> {
    await this.frontTextarea.fill(text);
    await this.frontTextarea.dispatchEvent("input");
    await this.frontTextarea.dispatchEvent("change");
    await this.frontTextarea.dispatchEvent("blur");
  }

  async fillBackText(text: string): Promise<void> {
    await this.backTextarea.fill(text);
    await this.backTextarea.dispatchEvent("input");
    await this.backTextarea.dispatchEvent("change");
    await this.backTextarea.dispatchEvent("blur");
  }

  async selectCategory(categoryName: string): Promise<void> {
    await this.categorySelectTrigger.click();
    await this.page.waitForSelector('[data-slot="select-content"]', { timeout: 2000 });
    await this.page
      .locator('[data-slot="select-content"] [data-slot="select-item"]')
      .filter({ hasText: categoryName })
      .click();
  }

  async selectNoCategory(): Promise<void> {
    await this.categorySelectTrigger.click();
    await this.page.waitForSelector('[data-slot="select-content"]', { timeout: 2000 });
    await this.page
      .locator('[data-slot="select-content"] [data-slot="select-item"]')
      .filter({ hasText: "No category" })
      .click();
  }

  async selectSource(sourceName: string): Promise<void> {
    await this.sourceSelectTrigger.click();
    await this.page.waitForSelector('[data-slot="select-content"]', { timeout: 2000 });
    await this.page
      .locator('[data-slot="select-content"] [data-slot="select-item"]')
      .filter({ hasText: sourceName })
      .click();
  }

  async selectNoSource(): Promise<void> {
    await this.sourceSelectTrigger.click();
    await this.page.waitForSelector('[data-slot="select-content"]', { timeout: 2000 });
    await this.page
      .locator('[data-slot="select-content"] [data-slot="select-item"]')
      .filter({ hasText: "No source" })
      .click();
  }

  async clickCancel(): Promise<void> {
    await this.cancelButton.click();
  }

  async clickSubmit(): Promise<void> {
    await this.submitButton.click();
  }

  async submitForm(): Promise<void> {
    await this.clickSubmit();
  }

  async isSubmitEnabled(): Promise<boolean> {
    return this.submitButton.isEnabled();
  }

  async isLoading(): Promise<boolean> {
    const buttonText = await this.submitButton.textContent();
    return buttonText?.includes("Saving") || buttonText?.includes("Creating") || false;
  }

  async fillCompleteFlashcard(front: string, back: string, category?: string, source?: string): Promise<void> {
    await this.fillFrontText(front);
    await this.fillBackText(back);

    if (category) {
      await this.selectCategory(category);
    } else {
      await this.selectNoCategory();
    }

    if (source) {
      await this.selectSource(source);
    } else {
      await this.selectNoSource();
    }
  }

  async createFlashcard(front: string, back: string, category?: string, source?: string): Promise<void> {
    await this.fillCompleteFlashcard(front, back, category, source);
    await this.submitForm();
  }

  async updateFlashcard(front: string, back: string, category?: string, source?: string): Promise<void> {
    await this.fillCompleteFlashcard(front, back, category, source);
    await this.submitForm();
  }

  async clearForm(): Promise<void> {
    await this.frontTextarea.clear();
    await this.backTextarea.clear();
  }

  async getFrontText(): Promise<string> {
    return this.frontTextarea.inputValue();
  }

  async getBackText(): Promise<string> {
    return this.backTextarea.inputValue();
  }

  async isFormValid(): Promise<boolean> {
    const frontValue = await this.getFrontText();
    const backValue = await this.getBackText();
    return frontValue.trim().length > 0 && backValue.trim().length > 0;
  }
}
