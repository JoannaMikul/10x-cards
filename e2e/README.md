# E2E Tests for 10x-cards

This directory contains end-to-end tests for the 10x-cards application using Playwright.

## Setup

### Environment Variables

Create a `.env.test` file in the root directory with the following variables:

```bash
# Test environment configuration
TEST_BASE_URL=http://localhost:3000

# Test user credentials
E2E_USERNAME=your-test-user@example.com
E2E_PASSWORD=your-test-password
```

**Note:** The `.env.test` file is already configured in `playwright.config.ts` to be loaded automatically.

### Database Setup

Make sure you have:
1. A test database instance running
2. Test user account created with the credentials above
3. Database schema migrated and seeded

## Running Tests

### Install Dependencies

```bash
npm install
```

### Run All Tests

```bash
npm run test:e2e
```

### Run Specific Test File

```bash
npx playwright test flashcards-management.spec.ts
```

### Run Tests with UI

```bash
npx playwright test --ui
```

### Run Tests in Debug Mode

```bash
npx playwright test --debug
```

### Generate Test Report

```bash
npx playwright show-report
```

## Test Structure

### Page Object Model (POM)

Tests use the Page Object Model pattern for better maintainability:

- `BasePage.ts` - Common functionality for all pages
- `LoginPage.ts` - Login page interactions
- `HomePage.ts` - Home page interactions
- `FlashcardsPage.ts` - Flashcards page interactions
- `FlashcardFormModal.ts` - Flashcard form modal interactions
- `ConfirmDialog.ts` - Confirmation dialog interactions

### Test Files

- `login.spec.ts` - Tests for login functionality
- `flashcards-management.spec.ts` - Tests for flashcard CRUD operations

## Test Scenarios

### Flashcards Management Workflow

The main test scenario covers:

1. **Login** - Authenticate with valid credentials
2. **Navigate to Flashcards** - Go to the flashcards page
3. **Create Flashcards** - Add 5 new flashcards with dynamic data
4. **Edit Flashcard** - Modify one of the created flashcards
5. **Delete Flashcard** - Remove one flashcard with confirmation
6. **Select for Review** - Select remaining flashcards and navigate to review

### Additional Test Cases

- Form validation
- Search functionality
- Selection mode toggle
- Dialog cancellation
- UI element visibility

## Best Practices

### Writing Tests

1. Use Page Object Model for all interactions
2. Follow AAA pattern (Arrange, Act, Assert)
3. Use `data-testid` attributes for element selection
4. Wait for elements to be ready before interaction
5. Use descriptive test names and assertions

### Example Test Structure

```typescript
test("should perform action", async ({ page }) => {
  // Arrange
  const pageObject = new PageObject(page);
  await pageObject.goto();

  // Act
  await pageObject.performAction();

  // Assert
  await expect(pageObject.element).toBeVisible();
});
```

### Debugging

1. Use `--debug` flag to step through tests
2. Use `await page.pause()` to stop execution
3. Check Playwright trace viewer for failed tests
4. Use `console.log` for debugging (remember to remove)

## CI/CD

Tests are configured to run in CI with:
- Single worker to avoid conflicts
- Retry on failure (2 retries)
- HTML report generation
- Screenshot on failure

## Troubleshooting

### Common Issues

1. **Timeout errors**: Increase timeout or wait for network idle
2. **Element not found**: Check if `data-testid` attributes are correct
3. **Flaky tests**: Add proper waits and assertions
4. **Database state**: Ensure clean test data between runs

### Environment Issues

1. **Server not running**: Tests start dev server automatically
2. **Database connection**: Check database connectivity
3. **Environment variables**: Ensure `.env.test` exists with correct values
