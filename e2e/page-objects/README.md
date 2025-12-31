# Page Object Model (POM)

This directory contains the implementation of the Page Object Model pattern for Playwright E2E tests.

## Structure

### BasePage

Base class containing common methods for all pages:

- `waitForLoad()` - waits for page to load
- `getTitle()` - gets the page title
- `getCurrentUrl()` - gets the current URL
- `waitForUrl()` - waits for specific URL
- `refresh()` - refreshes the page
- `takeScreenshot()` - takes a screenshot
- Other utility methods

### Specific Page Classes

Each application page has its dedicated class inheriting from `BasePage`:

#### LoginPage

Class for the login page (`/auth/login`) containing:

- Selectors for all form elements
- Methods for form interaction
- Validation methods
- Navigation methods

#### HomePage

Class for the home page (`/`) containing:

- Navigation element selectors
- Methods checking page state

## Usage

```typescript
import { LoginPage } from "./page-objects";

test("login test", async ({ page }) => {
  const loginPage = new LoginPage(page);

  // Navigate to login page
  await loginPage.goto();

  // Fill the form
  await loginPage.fillLoginForm("user@example.com", "password");

  // Sign in
  await loginPage.clickSignIn();

  // Check if login was successful
  await expect(page).toHaveURL("/");
});
```

## Rules

1. **One class per page** - Each page has its own Page Object class
2. **Separation of concerns** - Business logic in tests, locators in classes
3. **Inheritance** - All classes inherit from `BasePage`
4. **Descriptive methods** - Method names describe actions (e.g. `clickSignIn()`, `fillLoginForm()`)
5. **data-testid attributes** - All locators use `data-testid` attributes
6. **Element waiting** - Methods automatically wait for element visibility

## Adding a New Page

1. Create a new class inheriting from `BasePage`
2. Define locators using `page.getByTestId()`
3. Add interaction and validation methods
4. Update the `index.ts` file
5. Add tests in the appropriate `.spec.ts` file

## Example of Adding a New Class

```typescript
import { Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

export class RegisterPage extends BasePage {
  readonly registerForm: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly registerButton: Locator;

  constructor(page: any) {
    super(page);
    this.registerForm = page.getByTestId("register-form");
    // ... remaining locators
  }

  async register(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.fillConfirmPassword(password);
    await this.clickRegister();
  }
}
```
