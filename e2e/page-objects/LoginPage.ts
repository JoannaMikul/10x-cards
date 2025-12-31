import type { Page, Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

export class LoginPage extends BasePage {
  readonly loginPage: Locator;
  readonly loginContainer: Locator;
  readonly loginLogo: Locator;
  readonly loginTitle: Locator;
  readonly loginSubtitle: Locator;

  readonly loginForm: Locator;
  readonly authLayoutCard: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly togglePasswordVisibilityButton: Locator;
  readonly signInButton: Locator;
  readonly loginErrorAlert: Locator;

  readonly registerLink: Locator;
  readonly resetPasswordLink: Locator;

  constructor(page: Page) {
    super(page);

    this.loginPage = page.getByTestId("login-page");
    this.loginContainer = page.getByTestId("login-container");
    this.loginLogo = page.getByTestId("login-logo");
    this.loginTitle = page.getByTestId("login-title");
    this.loginSubtitle = page.getByTestId("login-subtitle");

    this.loginForm = page.getByTestId("login-form");
    this.authLayoutCard = page.getByTestId("auth-layout-card");
    this.emailInput = page.getByTestId("email-input");
    this.passwordInput = page.getByTestId("password-input");
    this.togglePasswordVisibilityButton = page.getByTestId("toggle-password-visibility");
    this.signInButton = page.getByTestId("sign-in-button");
    this.loginErrorAlert = page.getByTestId("login-error-alert");

    this.registerLink = page.getByTestId("register-link");
    this.resetPasswordLink = page.getByTestId("reset-password-link");
  }

  async goto(): Promise<void> {
    await this.page.goto("/auth/login");
    await this.page.reload();
  }

  async isLoaded(): Promise<boolean> {
    await this.loginPage.waitFor({ state: "visible" });
    return this.loginPage.isVisible();
  }

  async fillEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.emailInput.dispatchEvent("input");
    await this.emailInput.dispatchEvent("change");
    await this.emailInput.dispatchEvent("blur");
  }

  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
    await this.passwordInput.dispatchEvent("input");
    await this.passwordInput.dispatchEvent("change");
    await this.passwordInput.dispatchEvent("blur");
  }

  async clickSignIn(): Promise<void> {
    await this.signInButton.click();
  }

  async login(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickSignIn();
  }

  async togglePasswordVisibility(): Promise<void> {
    await this.togglePasswordVisibilityButton.click();
  }

  async isErrorVisible(): Promise<boolean> {
    return this.loginErrorAlert.isVisible();
  }

  async getErrorMessage(): Promise<string | null> {
    if (await this.isErrorVisible()) {
      return this.loginErrorAlert.textContent();
    }
    return null;
  }

  async isSignInEnabled(): Promise<boolean> {
    return this.signInButton.isEnabled();
  }

  async isLoading(): Promise<boolean> {
    return this.signInButton.locator("svg").isVisible();
  }

  async getPasswordInputType(): Promise<string | null> {
    return this.passwordInput.getAttribute("type");
  }

  async clickRegisterLink(): Promise<void> {
    await this.registerLink.click();
  }

  async clickResetPasswordLink(): Promise<void> {
    await this.resetPasswordLink.click();
  }

  async hasAllRequiredElements(): Promise<boolean> {
    const elements = [
      this.loginPage,
      this.loginForm,
      this.emailInput,
      this.passwordInput,
      this.signInButton,
      this.registerLink,
      this.resetPasswordLink,
    ];

    for (const element of elements) {
      if (!(await element.isVisible())) {
        return false;
      }
    }

    return true;
  }

  async clearForm(): Promise<void> {
    await this.emailInput.clear();
    await this.passwordInput.clear();
  }

  async getPageTitle(): Promise<string> {
    return this.page.title();
  }

  async getFormTitle(): Promise<string | null> {
    return this.loginTitle.textContent();
  }

  async getFormSubtitle(): Promise<string | null> {
    return this.loginSubtitle.textContent();
  }
}
