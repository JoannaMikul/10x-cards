import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";

export class FlashcardsPage extends BasePage {
  readonly flashcardsPage: Locator;
  readonly flashcardsTitle: Locator;
  readonly flashcardsSubtitle: Locator;
  readonly flashcardsCount: Locator;

  readonly flashcardsToolbar: Locator;
  readonly searchInput: Locator;
  readonly clearSearchButton: Locator;
  readonly addFlashcardButton: Locator;
  readonly selectionModeToggle: Locator;
  readonly reviewFlashcardsButton: Locator;
  readonly showDeletedCheckbox: Locator;
  readonly toggleFiltersButton: Locator;

  readonly selectionPanel: Locator;
  readonly selectionMode: Locator;
  readonly selectionDescription: Locator;
  readonly deletedCardsBadge: Locator;

  readonly flashcardList: Locator;
  readonly flashcardListEmpty: Locator;
  readonly flashcardItems: Locator;
  readonly loadMoreButton: Locator;

  readonly filtersForm: Locator;
  readonly resetFiltersButton: Locator;

  constructor(page: Page) {
    super(page);

    this.flashcardsPage = page.getByTestId("flashcards-content");
    this.flashcardsTitle = page.getByTestId("flashcards-title");
    this.flashcardsSubtitle = page.getByTestId("flashcards-subtitle");
    this.flashcardsCount = page.getByTestId("flashcards-count");

    this.flashcardsToolbar = page.getByTestId("flashcards-toolbar");
    this.searchInput = page.getByTestId("search-input");
    this.clearSearchButton = page.getByTestId("clear-search-button");
    this.addFlashcardButton = page.getByTestId("add-flashcard-button");
    this.selectionModeToggle = page.getByTestId("selection-mode-toggle");
    this.reviewFlashcardsButton = page.getByTestId("review-flashcards-button");
    this.showDeletedCheckbox = page.getByTestId("show-deleted-checkbox");
    this.toggleFiltersButton = page.getByTestId("toggle-filters-button");

    this.selectionPanel = page.getByTestId("selection-panel");
    this.selectionMode = page.getByTestId("selection-mode");
    this.selectionDescription = page.getByTestId("selection-description");
    this.deletedCardsBadge = page.getByTestId("deleted-cards-badge");

    this.flashcardList = page.getByTestId("flashcard-list");
    this.flashcardListEmpty = page.getByTestId("flashcard-list-empty");
    this.flashcardItems = page.getByTestId("flashcard-items");
    this.loadMoreButton = page.getByTestId("load-more-button");

    this.filtersForm = page.getByTestId("filters-form");
    this.resetFiltersButton = page.getByTestId("reset-filters-button");
  }

  async goto(): Promise<void> {
    await this.page.goto("/flashcards");
  }

  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState("networkidle");
  }

  async isLoaded(): Promise<boolean> {
    await this.flashcardsPage.waitFor({ state: "visible" });
    return this.flashcardsPage.isVisible();
  }

  async searchFlashcards(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(350);
  }

  async clearSearch(): Promise<void> {
    await this.clearSearchButton.click();
  }

  async clickAddFlashcard(): Promise<void> {
    await this.addFlashcardButton.click();
  }

  async toggleSelectionMode(): Promise<void> {
    await this.selectionModeToggle.click();
  }

  async clickReviewFlashcards(): Promise<void> {
    await this.reviewFlashcardsButton.click();
  }

  async toggleShowDeleted(): Promise<void> {
    await this.showDeletedCheckbox.click();
  }

  async toggleFilters(): Promise<void> {
    await this.toggleFiltersButton.click();
  }

  async getFlashcardCount(): Promise<number> {
    return this.flashcardItems.locator('[data-testid^="flashcard-item-"]').count();
  }

  async getFlashcardItem(cardId: string): Promise<Locator> {
    return this.page.getByTestId(`flashcard-item-${cardId}`);
  }

  async selectFlashcardForReview(cardId: string): Promise<void> {
    const checkbox = this.page.getByTestId(`select-checkbox-input-${cardId}`);
    await checkbox.click();
  }

  async editFlashcard(cardId: string): Promise<void> {
    const editButton = this.page.getByTestId(`edit-button-${cardId}`);
    await editButton.click();
  }

  async deleteFlashcard(cardId: string): Promise<void> {
    const deleteButton = this.page.getByTestId(`delete-button-${cardId}`);
    await deleteButton.click();
  }

  async restoreFlashcard(cardId: string): Promise<void> {
    const restoreButton = this.page.getByTestId(`restore-button-${cardId}`);
    await restoreButton.click();
  }

  async reviewSingleFlashcard(cardId: string): Promise<void> {
    const reviewButton = this.page.getByTestId(`review-card-button-${cardId}`);
    await reviewButton.click();
  }

  async loadMoreFlashcards(): Promise<void> {
    await this.loadMoreButton.click();
  }

  async getSelectionMode(): Promise<string | null> {
    return this.selectionMode.textContent();
  }

  async getSelectionDescription(): Promise<string | null> {
    return this.selectionDescription.textContent();
  }

  async isDeletedCardsBadgeVisible(): Promise<boolean> {
    return this.deletedCardsBadge.isVisible();
  }

  async resetFilters(): Promise<void> {
    await this.resetFiltersButton.click();
  }

  async areFiltersExpanded(): Promise<boolean> {
    return this.filtersForm.isVisible();
  }

  async waitForFlashcardsToLoad(): Promise<void> {
    await this.page.waitForLoadState("networkidle");
  }

  async getPageTitle(): Promise<string | null> {
    return this.flashcardsTitle.textContent();
  }

  async getFlashcardsCount(): Promise<string | null> {
    return this.flashcardsCount.textContent();
  }

  async isEmptyStateVisible(): Promise<boolean> {
    return this.flashcardListEmpty.isVisible();
  }

  async hasAddButton(): Promise<boolean> {
    return this.addFlashcardButton.isVisible();
  }

  async hasReviewButton(): Promise<boolean> {
    const isVisible = await this.reviewFlashcardsButton.isVisible();
    const isEnabled = await this.reviewFlashcardsButton.isEnabled();
    return isVisible && isEnabled;
  }

  async isLoadMoreVisible(): Promise<boolean> {
    return this.loadMoreButton.isVisible();
  }

  async getAllFlashcardIds(): Promise<string[]> {
    const flashcardElements = this.page.locator('[data-testid^="flashcard-item-"]');
    const count = await flashcardElements.count();
    const ids: string[] = [];

    for (let i = 0; i < count; i++) {
      const testId = await flashcardElements.nth(i).getAttribute("data-testid");
      if (testId) {
        const id = testId.replace("flashcard-item-", "");
        ids.push(id);
      }
    }

    return ids;
  }
}
