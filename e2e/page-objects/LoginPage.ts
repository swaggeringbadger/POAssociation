import { Page, Locator, expect } from '@playwright/test';

/**
 * Login Page Object
 *
 * Best Practices:
 * - Encapsulate page interactions in methods
 * - Use descriptive method names
 * - Store locators as class properties
 * - Include assertions within page objects where appropriate
 */
export class LoginPage {
  readonly page: Page;
  readonly demoCodeInput: Locator;
  readonly accessDemoButton: Locator;
  readonly personaCards: Locator;
  readonly errorToast: Locator;

  constructor(page: Page) {
    this.page = page;
    // Updated selectors based on actual UI
    this.demoCodeInput = page.getByPlaceholder('DEMO-CODE-HERE');
    this.accessDemoButton = page.getByRole('button', { name: /Access Demo/i });
    this.personaCards = page.locator('.cursor-pointer').filter({ has: page.getByRole('button', { name: /Login as/i }) });
    this.errorToast = page.locator('[role="status"]').or(page.locator('[data-sonner-toast]')).filter({ hasText: /invalid|error|failed/i });
  }

  /**
   * Navigate to the demo code entry page
   */
  async goto() {
    await this.page.goto('/demo');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Enter demo code and submit
   */
  async enterDemoCode(code: string) {
    await this.demoCodeInput.fill(code);
  }

  /**
   * Click the Access Demo button
   */
  async clickAccessDemo() {
    await this.accessDemoButton.click();
  }

  /**
   * Wait for persona selection page to load
   */
  async waitForPersonaSelection() {
    await this.page.waitForURL(/\/demo\/personas/, { timeout: 10000 });
    await expect(this.personaCards.first()).toBeVisible({ timeout: 10000 });
  }

  /**
   * Select a persona by first name
   */
  async selectPersona(firstName: string) {
    // Find the card containing this persona and click its button
    const personaButton = this.page.getByRole('button', { name: new RegExp(`Login as ${firstName}`, 'i') });
    await personaButton.click();
  }

  /**
   * Complete full demo login flow
   */
  async loginAsDemoUser(code: string, personaFirstName: string) {
    await this.goto();
    await this.enterDemoCode(code);
    await this.clickAccessDemo();

    // Wait for persona selection page
    await this.waitForPersonaSelection();

    // Select persona
    await this.selectPersona(personaFirstName);

    // Wait for redirect to dashboard
    await this.page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Verify we're on the demo code entry page
   */
  async verifyOnDemoCodePage() {
    await expect(this.demoCodeInput).toBeVisible();
    await expect(this.accessDemoButton).toBeVisible();
  }

  /**
   * Verify error message is displayed (toast notification)
   */
  async verifyErrorMessage(expectedMessage?: string) {
    await expect(this.errorToast.first()).toBeVisible({ timeout: 5000 });
    if (expectedMessage) {
      await expect(this.errorToast.first()).toContainText(expectedMessage, { ignoreCase: true });
    }
  }

  /**
   * Get available personas on the selection page
   */
  async getAvailablePersonas(): Promise<string[]> {
    const personaButtons = this.page.getByRole('button', { name: /Login as/i });
    const count = await personaButtons.count();
    const personas: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await personaButtons.nth(i).textContent();
      if (text) {
        // Extract name from "Login as Emily" -> "Emily"
        const match = text.match(/Login as (\w+)/i);
        if (match) personas.push(match[1]);
      }
    }

    return personas;
  }
}
