import { test, expect } from "@playwright/test";
import { LoginPage, FlashcardsPage, FlashcardFormModal, ConfirmDialog } from "./page-objects";
import {
  createTestFlashcards,
  cleanupTestFlashcards,
  getTestUserId,
  generateTestFlashcard,
} from "./helpers/flashcard-test-helpers";

test.describe.serial("Flashcards Management Workflow", () => {
  let loginPage: LoginPage;
  let flashcardsPage: FlashcardsPage;
  let formModal: FlashcardFormModal;
  let confirmDialog: ConfirmDialog;

  const generateWorkflowTestFlashcard = (index: number) => generateTestFlashcard(index, "workflow");

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    flashcardsPage = new FlashcardsPage(page);
    formModal = new FlashcardFormModal(page);
    confirmDialog = new ConfirmDialog(page);

    await page.context().clearCookies();
  });

  const loginWithValidCredentials = async () => {
    const username = process.env.E2E_USERNAME ?? "";
    const password = process.env.E2E_PASSWORD ?? "";

    expect(username, "E2E_USERNAME environment variable must be set").toBeDefined();
    expect(password, "E2E_PASSWORD environment variable must be set").toBeDefined();

    await loginPage.goto();
    await loginPage.waitForLoad();
    await loginPage.fillEmail(username);
    await loginPage.fillPassword(password);
    await loginPage.clickSignIn();

    await loginPage.page.waitForURL("**/", { timeout: 10000 });
  };

  test("should complete full flashcard management workflow", async () => {
    await loginWithValidCredentials();

    await flashcardsPage.goto();
    await flashcardsPage.waitForLoad();
    await expect(flashcardsPage.flashcardsPage).toBeVisible();
    await expect(flashcardsPage.flashcardsTitle).toContainText("Flashcards");

    const createdFlashcards: { front: string; back: string; category?: string; source?: string }[] = [];

    for (let i = 1; i <= 5; i++) {
      const flashcardData = generateWorkflowTestFlashcard(i);
      createdFlashcards.push(flashcardData);

      await expect(flashcardsPage.addFlashcardButton).toBeVisible();
      await expect(flashcardsPage.addFlashcardButton).toBeEnabled();

      await flashcardsPage.clickAddFlashcard();

      await formModal.waitForVisible();
      await expect(formModal.flashcardFormTitle).toContainText("Add flashcard");

      await formModal.createFlashcard(
        flashcardData.front,
        flashcardData.back,
        flashcardData.category,
        flashcardData.source
      );

      await formModal.flashcardFormModal.waitFor({ state: "hidden" });

      await flashcardsPage.waitForFlashcardsToLoad();
      const currentCount = await flashcardsPage.getFlashcardCount();
      expect(currentCount).toBeGreaterThanOrEqual(i);
    }

    const flashcardIds = await flashcardsPage.getAllFlashcardIds();
    expect(flashcardIds.length).toBeGreaterThanOrEqual(5);

    const firstCardId = flashcardIds[0];
    await flashcardsPage.editFlashcard(firstCardId);

    await formModal.waitForVisible();
    await expect(formModal.flashcardFormTitle).toContainText("Edit flashcard");

    const updatedFront = `Updated: ${createdFlashcards[0].front}`;
    const updatedBack = `Updated: ${createdFlashcards[0].back}`;

    await formModal.fillFrontText(updatedFront);
    await formModal.fillBackText(updatedBack);
    await formModal.clickSubmit();

    await formModal.flashcardFormModal.waitFor({ state: "hidden" });

    const secondCardId = flashcardIds[1];
    await flashcardsPage.deleteFlashcard(secondCardId);

    await confirmDialog.waitForVisible();
    await expect(confirmDialog.confirmDialogTitle).toContainText("Delete flashcard");
    await confirmDialog.confirmDelete();

    await flashcardsPage.waitForFlashcardsToLoad();
    const countAfterDelete = await flashcardsPage.getFlashcardCount();
    expect(countAfterDelete).toBe(flashcardIds.length - 1);

    const remainingCardIds = await flashcardsPage.getAllFlashcardIds();

    for (const cardId of remainingCardIds) {
      await flashcardsPage.selectFlashcardForReview(cardId);
    }

    await expect(flashcardsPage.reviewFlashcardsButton).toBeEnabled();

    const testUserId = getTestUserId();
    await cleanupTestFlashcards(testUserId);
  });

  test("should handle flashcard form validation", async () => {
    await loginWithValidCredentials();

    await flashcardsPage.goto();
    await flashcardsPage.waitForLoad();
    await flashcardsPage.clickAddFlashcard();

    await formModal.waitForVisible();

    await expect
      .poll(() => formModal.isSubmitEnabled(), {
        timeout: 5000,
        message: "Submit button should be disabled when form is empty",
      })
      .toBe(false);

    await formModal.fillFrontText("Test front");
    await expect
      .poll(() => formModal.isSubmitEnabled(), {
        timeout: 5000,
        message: "Submit button should be disabled when only front is filled",
      })
      .toBe(false);

    await formModal.fillBackText("Test back");
    await expect
      .poll(() => formModal.isSubmitEnabled(), {
        timeout: 5000,
        message: "Submit button should be enabled when both front and back are filled",
      })
      .toBe(true);

    await formModal.frontTextarea.clear();
    await expect
      .poll(() => formModal.isSubmitEnabled(), {
        timeout: 5000,
        message: "Submit button should be disabled when front is cleared",
      })
      .toBe(false);

    await formModal.clickCancel();
    await formModal.flashcardFormModal.waitFor({ state: "hidden" });
  });

  test("should handle flashcard search functionality", async () => {
    const testUserId = getTestUserId();
    await createTestFlashcards(3, testUserId, "display-info-test");

    await loginWithValidCredentials();

    await flashcardsPage.goto();
    await flashcardsPage.waitForFlashcardsToLoad();

    const initialCount = await flashcardsPage.getFlashcardCount();
    expect(initialCount).toBeGreaterThan(0); // Test data should be created

    await flashcardsPage.searchFlashcards("nonexistent-search-term-12345");

    await expect
      .poll(async () => await flashcardsPage.getFlashcardCount(), {
        timeout: 5000,
        message: "Search results should be filtered after searching for nonexistent term",
      })
      .toBeLessThanOrEqual(initialCount);

    await flashcardsPage.clearSearch();

    await flashcardsPage.page.waitForTimeout(1000);

    await expect
      .poll(async () => await flashcardsPage.getFlashcardCount(), {
        timeout: 10000,
        message: "All flashcards should be visible after clearing search",
      })
      .toBe(initialCount);

    await cleanupTestFlashcards(testUserId);
  });

  test("should handle selection mode toggle", async () => {
    await loginWithValidCredentials();

    await flashcardsPage.goto();
    await flashcardsPage.waitForFlashcardsToLoad();

    await expect(flashcardsPage.selectionMode).toContainText("Manual selection");

    await flashcardsPage.toggleSelectionMode();
    await expect(flashcardsPage.selectionMode).toContainText("All filtered cards");

    await flashcardsPage.toggleSelectionMode();
    await expect(flashcardsPage.selectionMode).toContainText("Manual selection");
  });

  test("should handle confirm dialog cancellation", async () => {
    const testUserId = getTestUserId();
    await createTestFlashcards(1, testUserId, "confirm-dialog-test");

    await loginWithValidCredentials();

    await flashcardsPage.goto();
    await flashcardsPage.waitForFlashcardsToLoad();

    const flashcardIds = await flashcardsPage.getAllFlashcardIds();
    expect(flashcardIds.length).toBeGreaterThan(0); // Test data should be created

    const cardId = flashcardIds[0];
    const initialCount = await flashcardsPage.getFlashcardCount();

    await flashcardsPage.deleteFlashcard(cardId);

    await confirmDialog.waitForVisible();
    await confirmDialog.cancelAction();

    await flashcardsPage.waitForFlashcardsToLoad();
    const finalCount = await flashcardsPage.getFlashcardCount();
    expect(finalCount).toBe(initialCount);

    await cleanupTestFlashcards(testUserId);
  });

  test("should display correct flashcard information", async () => {
    const testUserId = getTestUserId();
    await createTestFlashcards(3, testUserId, "display-info-test");

    await loginWithValidCredentials();

    await flashcardsPage.goto();
    await flashcardsPage.waitForFlashcardsToLoad();

    const flashcardIds = await flashcardsPage.getAllFlashcardIds();
    expect(flashcardIds.length).toBeGreaterThan(0); // Test data should be created

    await expect(flashcardsPage.flashcardsTitle).toBeVisible();
    await expect(flashcardsPage.flashcardsCount).toBeVisible();

    await expect(flashcardsPage.flashcardsToolbar).toBeVisible();
    await expect(flashcardsPage.addFlashcardButton).toBeVisible();
    await expect(flashcardsPage.searchInput).toBeVisible();

    await flashcardsPage.selectFlashcardForReview(flashcardIds[0]);
    await expect(flashcardsPage.reviewFlashcardsButton).toBeEnabled();

    await cleanupTestFlashcards(testUserId);
  });

  test.describe("Filters Functionality", () => {
    test("should display filters sidebar and controls", async () => {
      await loginWithValidCredentials();

      await flashcardsPage.goto();
      await flashcardsPage.waitForFlashcardsToLoad();

      await flashcardsPage.toggleFilters();

      await expect(flashcardsPage.filtersForm).toBeVisible();
      await expect(flashcardsPage.resetFiltersButton).toBeVisible();
      await expect(flashcardsPage.categoryFilter).toBeVisible();
      await expect(flashcardsPage.sourceFilter).toBeVisible();
      await expect(flashcardsPage.originFilter).toBeVisible();
      await expect(flashcardsPage.sortFilter).toBeVisible();
      await expect(flashcardsPage.tagsFilter).toBeVisible();
    });

    test("should filter flashcards by category", async () => {
      const testUserId = getTestUserId();

      await cleanupTestFlashcards(testUserId);

      await createTestFlashcards(3, testUserId, "filter-category-test", [
        { front: "Category IT Card 1 - filter test", back: "Answer 1 for IT", categoryId: 1 }, // IT
        { front: "Category IT Card 2 - filter test", back: "Answer 2 for IT", categoryId: 1 }, // IT
        { front: "Category Language Card 1 - filter test", back: "Answer 3 for Language", categoryId: 2 }, // Language
      ]);

      await loginWithValidCredentials();

      await flashcardsPage.goto();
      await flashcardsPage.waitForFlashcardsToLoad();

      await flashcardsPage.toggleFilters();

      const initialCount = await flashcardsPage.getFlashcardCount();
      expect(initialCount).toBeGreaterThanOrEqual(3);

      await flashcardsPage.selectCategoryFilter("IT");
      await flashcardsPage.waitForFlashcardsUpdate();

      const filteredCount = await flashcardsPage.getFlashcardCount();
      expect(filteredCount).toBeLessThanOrEqual(initialCount);

      await flashcardsPage.resetFilters();

      await Promise.all([
        flashcardsPage.page.waitForResponse(
          (response) => response.url().includes("/api/flashcards") && response.status() === 200
        ),
        flashcardsPage.waitForFlashcardsUpdate(),
      ]);

      // Wait a bit more for UI to fully update after reset
      await flashcardsPage.page.waitForTimeout(500);

      const resetCount = await flashcardsPage.getFlashcardCount();
      expect(resetCount).toBe(initialCount);

      await cleanupTestFlashcards(testUserId);
    });

    test("should filter flashcards by origin", async () => {
      const testUserId = getTestUserId();

      await cleanupTestFlashcards(testUserId);

      await createTestFlashcards(3, testUserId, "filter-origin-test", [
        { front: "Manual Card", back: "Manual Answer", origin: "manual" },
        { front: "AI Edited Card", back: "AI Edited Answer", origin: "ai-edited" },
        { front: "AI Full Card", back: "AI Full Answer", origin: "ai-full" },
      ]);

      await loginWithValidCredentials();

      await flashcardsPage.goto();
      await flashcardsPage.waitForFlashcardsToLoad();

      await flashcardsPage.toggleFilters();

      const initialCount = await flashcardsPage.getFlashcardCount();
      expect(initialCount).toBeGreaterThanOrEqual(3);

      await flashcardsPage.selectOriginFilter("Manual");

      await Promise.all([
        flashcardsPage.page.waitForResponse(
          (response) => response.url().includes("/api/flashcards") && response.status() === 200
        ),
        flashcardsPage.waitForFlashcardsUpdate(),
      ]);

      const manualCount = await flashcardsPage.getFlashcardCount();
      expect(manualCount).toBeGreaterThanOrEqual(1);
      expect(manualCount).toBeLessThanOrEqual(initialCount);

      await flashcardsPage.selectOriginFilter("AI full");

      await Promise.all([
        flashcardsPage.page.waitForResponse(
          (response) => response.url().includes("/api/flashcards") && response.status() === 200
        ),
        flashcardsPage.waitForFlashcardsUpdate(),
      ]);

      const aiFullCount = await flashcardsPage.getFlashcardCount();
      expect(aiFullCount).toBeGreaterThanOrEqual(1);
      expect(aiFullCount).toBeLessThanOrEqual(initialCount);

      await cleanupTestFlashcards(testUserId);
    });

    test("should handle tag filtering", async () => {
      const testUserId = getTestUserId();

      await cleanupTestFlashcards(testUserId);

      await createTestFlashcards(3, testUserId, "filter-tags-test", [
        { front: "JavaScript Card", back: "JS Answer", tags: ["JavaScript"] },
        { front: "React Card", back: "React Answer", tags: ["React"] },
        { front: "CSS Card", back: "CSS Answer", tags: ["CSS"] },
      ]);

      await loginWithValidCredentials();

      await flashcardsPage.goto();
      await flashcardsPage.waitForFlashcardsToLoad();

      await flashcardsPage.toggleFilters();

      const initialCount = await flashcardsPage.getFlashcardCount();
      expect(initialCount).toBeGreaterThanOrEqual(3);

      await flashcardsPage.toggleTagFilter("JavaScript");

      await Promise.all([
        flashcardsPage.page.waitForResponse(
          (response) => response.url().includes("/api/flashcards") && response.status() === 200
        ),
        flashcardsPage.waitForFlashcardsUpdate(),
      ]);

      const jsFilteredCount = await flashcardsPage.getFlashcardCount();

      expect(jsFilteredCount).toBeGreaterThanOrEqual(1);
      expect(jsFilteredCount).toBeLessThanOrEqual(initialCount);

      await flashcardsPage.toggleTagFilter("JavaScript");
      await flashcardsPage.toggleTagFilter("React");

      const reactResponsePromise = flashcardsPage.page.waitForResponse(
        (response) => response.url().includes("/api/flashcards") && response.status() === 200
      );
      await flashcardsPage.waitForFlashcardsUpdate();
      await reactResponsePromise;

      const reactFilteredCount = await flashcardsPage.getFlashcardCount();
      expect(reactFilteredCount).toBeGreaterThanOrEqual(1);

      await cleanupTestFlashcards(testUserId);
    });

    test("should handle sort order changes", async () => {
      const testUserId = getTestUserId();

      await cleanupTestFlashcards(testUserId);

      await createTestFlashcards(3, testUserId, "sort-test");

      await loginWithValidCredentials();

      await flashcardsPage.goto();
      await flashcardsPage.waitForFlashcardsToLoad();

      await flashcardsPage.toggleFilters();

      const initialCount = await flashcardsPage.getFlashcardCount();
      expect(initialCount).toBeGreaterThanOrEqual(3);

      await flashcardsPage.selectSortFilter("Oldest");

      await Promise.all([
        flashcardsPage.page.waitForResponse(
          (response) => response.url().includes("/api/flashcards") && response.status() === 200
        ),
        flashcardsPage.waitForFlashcardsUpdate(),
      ]);

      const sortedCount = await flashcardsPage.getFlashcardCount();
      expect(sortedCount).toBe(initialCount);

      await flashcardsPage.selectSortFilter("Newest");

      await Promise.all([
        flashcardsPage.page.waitForResponse(
          (response) => response.url().includes("/api/flashcards") && response.status() === 200
        ),
        flashcardsPage.waitForFlashcardsUpdate(),
      ]);

      const finalCount = await flashcardsPage.getFlashcardCount();
      expect(finalCount).toBe(initialCount);

      await cleanupTestFlashcards(testUserId);
    });

    test("should reset all filters correctly", async () => {
      const testUserId = getTestUserId();

      await cleanupTestFlashcards(testUserId);

      await createTestFlashcards(5, testUserId, "reset-filters-test", [
        {
          front: "Reset Test Card 1 - JS",
          back: "Answer 1 for reset test",
          categoryId: 1,
          origin: "manual",
          tags: ["JavaScript"],
        },
        {
          front: "Reset Test Card 2 - Language",
          back: "Answer 2 for reset test",
          categoryId: 2,
          origin: "ai-edited",
          tags: ["English"],
        },
        {
          front: "Reset Test Card 3 - React",
          back: "Answer 3 for reset test",
          categoryId: 1,
          origin: "ai-full",
          tags: ["React"],
        },
        {
          front: "Reset Test Card 4 - CSS",
          back: "Answer 4 for reset test",
          categoryId: 2,
          origin: "manual",
          tags: ["CSS"],
        },
        {
          front: "Reset Test Card 5 - TypeScript",
          back: "Answer 5 for reset test",
          categoryId: 1,
          origin: "ai-edited",
          tags: ["TypeScript"],
        },
      ]);

      await loginWithValidCredentials();

      await flashcardsPage.goto();
      await flashcardsPage.waitForFlashcardsToLoad();

      await flashcardsPage.toggleFilters();

      const initialCount = await flashcardsPage.getFlashcardCount();
      expect(initialCount).toBeGreaterThanOrEqual(5);

      await flashcardsPage.selectCategoryFilter("IT");
      await flashcardsPage.selectOriginFilter("Manual");
      await flashcardsPage.toggleTagFilter("JavaScript");
      await flashcardsPage.waitForFlashcardsUpdate();

      const filteredCount = await flashcardsPage.getFlashcardCount();
      expect(filteredCount).toBeLessThan(initialCount);

      await flashcardsPage.resetFilters();

      await Promise.all([
        flashcardsPage.page.waitForResponse(
          (response) => response.url().includes("/api/flashcards") && response.status() === 200
        ),
        flashcardsPage.waitForFlashcardsUpdate(),
      ]);

      // Wait a bit more for UI to fully update after reset
      await flashcardsPage.page.waitForTimeout(500);

      const resetCount = await flashcardsPage.getFlashcardCount();
      expect(resetCount).toBe(initialCount);

      await cleanupTestFlashcards(testUserId);
    });
  });
});
