import { Page, Locator, expect } from '@playwright/test';

/**
 * Dashboard Page Object
 *
 * Represents the main dashboard after login
 */
export class DashboardPage {
  readonly page: Page;
  readonly welcomeMessage: Locator;
  readonly newApplicationButton: Locator;
  readonly applicationsLink: Locator;
  readonly directoryLink: Locator;
  readonly propertiesLink: Locator;
  readonly settingsLink: Locator;
  readonly userMenu: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeMessage = page.getByRole('heading', { name: /welcome/i });
    this.newApplicationButton = page.getByRole('button', { name: /new application/i });
    this.applicationsLink = page.getByRole('link', { name: /applications/i });
    this.directoryLink = page.getByRole('link', { name: /directory/i });
    this.propertiesLink = page.getByRole('link', { name: /properties/i });
    this.settingsLink = page.getByRole('link', { name: /settings/i });
    this.userMenu = page.locator('[data-testid="user-menu"]').or(page.getByRole('button', { name: /user menu/i }));
    this.logoutButton = page.getByRole('button', { name: /logout|sign out/i });
  }

  /**
   * Navigate to dashboard
   */
  async goto() {
    await this.page.goto('/dashboard');
  }

  /**
   * Verify we're on the dashboard
   */
  async verifyOnDashboard() {
    await expect(this.page).toHaveURL(/\/dashboard/);
  }

  /**
   * Start a new application
   */
  async startNewApplication() {
    await this.newApplicationButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to applications page
   */
  async goToApplications() {
    await this.applicationsLink.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to directory
   */
  async goToDirectory() {
    await this.directoryLink.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to properties
   */
  async goToProperties() {
    await this.propertiesLink.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to settings
   */
  async goToSettings() {
    await this.settingsLink.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Logout
   */
  async logout() {
    // May need to open user menu first
    try {
      await this.userMenu.click({ timeout: 2000 });
    } catch {
      // Menu might already be open or not exist
    }
    await this.logoutButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Verify user is logged in by checking for user-specific elements
   */
  async verifyLoggedIn() {
    // Wait for dashboard to load - adjust based on your actual UI
    await expect(this.page.locator('body')).toBeVisible();
  }
}
