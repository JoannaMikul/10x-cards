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

    // Cleanup: remove test data created by this test
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
    // Setup: create test data for this test
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

    // Cleanup: remove test data (at the very end)
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
    // Setup: create test data for this test
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

    // Cleanup: remove test data
    await cleanupTestFlashcards(testUserId);
  });

  test("should display correct flashcard information", async () => {
    // Setup: create test data for this test
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

    // Cleanup: remove test data
    await cleanupTestFlashcards(testUserId);
  });
});
