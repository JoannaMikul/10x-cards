import { test, expect } from "@playwright/test";
import { LoginPage } from "./page-objects";

test.describe("Login page", () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();

    loginPage = new LoginPage(page);
    await loginPage.goto();

    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500); // Extra time for React hydration
  });

  const fillValidCredentials = async (email = "user@example.com", password = "password123") => {
    await loginPage.clearForm();
    await loginPage.fillEmail(email);
    await expect.poll(() => loginPage.signInButton.isDisabled()).toBe(true);
    await loginPage.fillPassword(password);
    await expect.poll(() => loginPage.isSignInEnabled()).toBe(true);
  };

  test("should load login page successfully", async () => {
    await expect(loginPage.loginPage).toBeVisible();
    await expect(loginPage.loginForm).toBeVisible();
    await expect.poll(() => loginPage.hasAllRequiredElements()).toBe(true);
  });

  test("should display correct page title and content", async () => {
    await expect(loginPage.loginTitle).toContainText("Welcome to 10x-cards");
    await expect(loginPage.loginSubtitle).toContainText("Sign in to start generating smart flashcards");
    await expect(loginPage.loginLogo).toBeVisible();
  });

  test("should have all form elements visible and enabled", async () => {
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.signInButton).toBeVisible();
    await expect(loginPage.registerLink).toBeVisible();
    await expect(loginPage.resetPasswordLink).toBeVisible();

    await expect.poll(() => loginPage.isSignInEnabled()).toBe(false);
  });

  test("should enable sign in button when form is valid", async () => {
    await fillValidCredentials();
  });

  test("should validate email format", async () => {
    await loginPage.fillEmail("invalid-email");
    await expect.poll(() => loginPage.isSignInEnabled()).toBe(false);
  });

  test("should toggle password visibility", async () => {
    await loginPage.clearForm();
    await loginPage.fillPassword("testpassword");
    await expect.poll(() => loginPage.getPasswordInputType()).toBe("password");
    await loginPage.togglePasswordVisibility();
    await expect.poll(() => loginPage.getPasswordInputType()).toBe("text");
    await loginPage.togglePasswordVisibility();
    await expect.poll(() => loginPage.getPasswordInputType()).toBe("password");
    await loginPage.clearForm();
  });

  test("should show error message for invalid credentials", async () => {
    await loginPage.clearForm();

    await loginPage.fillEmail("test@example.com");
    await loginPage.fillPassword("testpass123");

    await expect
      .poll(() => loginPage.isSignInEnabled(), {
        timeout: 5000,
        message: "Sign in button should be enabled when form is properly filled",
      })
      .toBe(true);

    const requestPromise = loginPage.page.waitForRequest("**/api/auth/login");
    const responsePromise = loginPage.page.waitForResponse("**/api/auth/login");

    await loginPage.clickSignIn();

    const request = await requestPromise;
    const response = await responsePromise;

    expect(request.postDataJSON()).toEqual({
      email: "test@example.com",
      password: "testpass123",
    });

    expect(response.status()).toBe(401);

    await expect
      .poll(() => loginPage.isErrorVisible(), {
        timeout: 3000,
        message: "Error message should be visible after receiving 401 response",
      })
      .toBe(true);

    const errorMessage = await loginPage.getErrorMessage();
    await expect(errorMessage).toContain("Invalid email or password");
  });

  test("should navigate to register page when register link is clicked", async () => {
    await loginPage.clickRegisterLink();
    await expect(loginPage.page).toHaveURL("/auth/register");
  });

  test("should navigate to reset password page when reset password link is clicked", async () => {
    await loginPage.clickResetPasswordLink();
    await expect(loginPage.page).toHaveURL("/auth/reset-password");
  });

  test("should show loading state during form submission", async () => {
    await loginPage.clearForm();
    await loginPage.fillEmail("user@example.com");
    await loginPage.fillPassword("password123");

    await expect
      .poll(() => loginPage.isSignInEnabled(), {
        timeout: 2000,
        message: "Sign in button should be enabled when form is filled",
      })
      .toBe(true);

    const requestPromise = loginPage.page.waitForRequest("**/api/auth/login");
    const responsePromise = loginPage.page.waitForResponse("**/api/auth/login");

    await loginPage.clickSignIn();

    await expect
      .poll(() => loginPage.isLoading(), {
        timeout: 1000,
        message: "Loading spinner should appear immediately after clicking sign in",
      })
      .toBe(true);

    await expect
      .poll(() => loginPage.isSignInEnabled(), {
        timeout: 1000,
        message: "Sign in button should be disabled during loading",
      })
      .toBe(false);

    await requestPromise;
    await responsePromise;
  });

  test("should clear form", async () => {
    await loginPage.clearForm();
    await loginPage.fillEmail("test@example.com");
    await expect.poll(() => loginPage.signInButton.isDisabled()).toBe(true);
    await loginPage.fillPassword("testpassword");
    await loginPage.clearForm();
    await expect(loginPage.emailInput).toHaveValue("");
    await expect(loginPage.passwordInput).toHaveValue("");
    await expect.poll(() => loginPage.isSignInEnabled()).toBe(false);
  });

  test("should login successfully with valid credentials", async () => {
    await loginPage.clearForm();

    const username = process.env.E2E_USERNAME ?? "";
    const password = process.env.E2E_PASSWORD ?? "";

    expect(username).toBeDefined();
    expect(password).toBeDefined();

    await loginPage.fillEmail(username);
    await loginPage.fillPassword(password);

    await expect
      .poll(() => loginPage.isSignInEnabled(), {
        timeout: 2000,
        message: "Sign in button should be enabled when form is filled",
      })
      .toBe(true);

    const loginPromise = loginPage.page.waitForRequest("**/api/auth/login");
    const responsePromise = loginPage.page.waitForResponse("**/api/auth/login");

    await loginPage.clickSignIn();

    const request = await loginPromise;
    expect(request.postDataJSON()).toEqual({ email: username, password: password });

    const response = await responsePromise;
    expect(response.status()).toBe(200);

    await loginPage.page.waitForURL("**/", { timeout: 10000 });

    await expect(loginPage.page.getByText("Welcome to 10x-cards")).toBeVisible({ timeout: 10000 });
    await expect(loginPage.page.getByText("Accelerate your learning with AI-powered flashcards")).toBeVisible();
  });
});
