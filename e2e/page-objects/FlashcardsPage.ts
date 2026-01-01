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

  // Filter controls
  readonly categoryFilter: Locator;
  readonly sourceFilter: Locator;
  readonly originFilter: Locator;
  readonly sortFilter: Locator;
  readonly tagsFilter: Locator;

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

    // Filter controls
    this.categoryFilter = page.locator('[aria-label="Filter by category"]');
    this.sourceFilter = page.locator('[aria-label="Filter by source"]');
    this.originFilter = page.locator('[aria-label="Filter by origin"]');
    this.sortFilter = page.locator('label:has-text("Sort order")').locator("..").locator("button");
    this.tagsFilter = page.locator('label:has-text("Tags")').locator("..").locator(".flex.flex-row");
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

  async selectCategoryFilter(value: string): Promise<void> {
    await this.categoryFilter.click();
    await this.page.getByRole("option", { name: value }).click();
  }

  async selectSourceFilter(value: string): Promise<void> {
    await this.sourceFilter.click();
    await this.page.getByRole("option", { name: value }).click();
  }

  async selectOriginFilter(value: string): Promise<void> {
    await this.originFilter.click();
    await this.page.getByRole("option", { name: value }).click();
  }

  async selectSortFilter(value: string): Promise<void> {
    await this.sortFilter.click();
    await this.page.getByRole("option", { name: value }).click();
  }

  async toggleTagFilter(tagName: string): Promise<void> {
    const tagLabel = this.tagsFilter.locator(`label:has-text("${tagName}")`);
    await tagLabel.click();
  }

  async getSelectedCategoryFilter(): Promise<string | null> {
    return this.categoryFilter.locator(".select-value").textContent();
  }

  async getSelectedSourceFilter(): Promise<string | null> {
    return this.sourceFilter.locator(".select-value").textContent();
  }

  async getSelectedOriginFilter(): Promise<string | null> {
    return this.originFilter.locator(".select-value").textContent();
  }

  async getSelectedSortFilter(): Promise<string | null> {
    return this.sortFilter.locator(".select-value").textContent();
  }

  async getActiveTagFilters(): Promise<string[]> {
    const activeTags: string[] = [];
    const tagLabels = this.tagsFilter.locator('label[class*="border-primary"]');
    const count = await tagLabels.count();

    for (let i = 0; i < count; i++) {
      const tagText = await tagLabels.nth(i).textContent();
      if (tagText) {
        activeTags.push(tagText.trim());
      }
    }

    return activeTags;
  }

  async waitForFlashcardsToLoad(): Promise<void> {
    await this.page.waitForLoadState("networkidle");
    await this.page.locator('[data-testid="flashcard-list"]').waitFor({ state: "visible", timeout: 5000 });
  }

  async waitForFlashcardsUpdate(): Promise<void> {
    // Wait for any network requests to complete
    await this.page.waitForLoadState("networkidle");

    // Wait for flashcard list to be updated by checking if it's not in a loading state
    // and that the items are rendered (wait up to 5 seconds for updates)
    await this.page.waitForFunction(
      () => {
        const flashcardList = document.querySelector('[data-testid="flashcard-list"]');
        const flashcardItems = document.querySelectorAll('[data-testid^="flashcard-item-"]');
        return flashcardList && flashcardItems.length >= 0; // Allow for 0 items when filtered
      },
      { timeout: 5000 }
    );

    // Additional small delay to ensure all DOM updates are complete
    await this.page.waitForTimeout(500);
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
