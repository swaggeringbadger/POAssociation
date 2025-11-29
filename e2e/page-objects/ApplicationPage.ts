import { Page, Locator, expect } from '@playwright/test';

/**
 * Application Page Object
 *
 * Handles application creation, viewing, and management
 */
export class ApplicationPage {
  readonly page: Page;
  readonly projectTypeCards: Locator;
  readonly continueButton: Locator;
  readonly backButton: Locator;
  readonly submitButton: Locator;
  readonly saveAsDraftButton: Locator;
  readonly applicationsList: Locator;
  readonly statusBadge: Locator;
  readonly nextStepButton: Locator;
  readonly previousStepButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.projectTypeCards = page.locator('[data-testid="project-type-card"]');
    this.continueButton = page.getByRole('button', { name: /continue/i });
    this.backButton = page.getByRole('button', { name: /back/i });
    this.submitButton = page.getByRole('button', { name: /submit/i });
    this.saveAsDraftButton = page.getByRole('button', { name: /save.*draft/i });
    this.applicationsList = page.locator('[data-testid="applications-list"]');
    this.statusBadge = page.locator('[data-testid="status-badge"]');
    this.nextStepButton = page.getByRole('button', { name: /next/i });
    this.previousStepButton = page.getByRole('button', { name: /previous/i });
  }

  /**
   * Navigate to application type selection
   */
  async gotoApplicationTypeSelect() {
    await this.page.goto('/applications/new');
  }

  /**
   * Navigate to applications list
   */
  async gotoApplicationsList() {
    await this.page.goto('/applications');
  }

  /**
   * Select a project type
   */
  async selectProjectType(projectType: string) {
    await this.page.getByRole('button', { name: new RegExp(projectType, 'i') }).click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Fill in a text field in the application form
   */
  async fillField(fieldLabel: string, value: string) {
    const field = this.page.getByLabel(new RegExp(fieldLabel, 'i'));
    await field.fill(value);
  }

  /**
   * Fill in multiple form fields
   */
  async fillFormFields(fields: Record<string, string>) {
    for (const [label, value] of Object.entries(fields)) {
      await this.fillField(label, value);
    }
  }

  /**
   * Upload a document
   */
  async uploadDocument(inputName: string, filePath: string) {
    const fileInput = this.page.locator(`input[type="file"][name="${inputName}"]`);
    await fileInput.setInputFiles(filePath);
  }

  /**
   * Move to next step in multi-step form
   */
  async goToNextStep() {
    await this.nextStepButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Move to previous step in multi-step form
   */
  async goToPreviousStep() {
    await this.previousStepButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Save application as draft
   */
  async saveAsDraft() {
    await this.saveAsDraftButton.click();
    await expect(this.page.getByText(/saved.*draft/i)).toBeVisible({ timeout: 5000 });
  }

  /**
   * Submit the application
   */
  async submitApplication() {
    await this.submitButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Verify application appears in list with expected status
   */
  async verifyApplicationInList(expectedStatus?: string) {
    await expect(this.applicationsList).toBeVisible();
    if (expectedStatus) {
      await expect(this.statusBadge.filter({ hasText: new RegExp(expectedStatus, 'i') })).toBeVisible();
    }
  }

  /**
   * Open an application by ID or index
   */
  async openApplication(identifier: string | number) {
    if (typeof identifier === 'number') {
      await this.applicationsList.locator('[data-testid="application-row"]').nth(identifier).click();
    } else {
      await this.page.goto(`/applications/${identifier}`);
    }
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Verify application status
   */
  async verifyStatus(expectedStatus: string) {
    await expect(this.statusBadge).toContainText(expectedStatus, { ignoreCase: true });
  }

  /**
   * Add a comment to the application
   */
  async addComment(comment: string) {
    await this.page.getByPlaceholder(/comment/i).fill(comment);
    await this.page.getByRole('button', { name: /add comment|post/i }).click();
    await expect(this.page.getByText(comment)).toBeVisible({ timeout: 5000 });
  }

  /**
   * Approve application (for reviewers)
   */
  async approveApplication() {
    await this.page.getByRole('button', { name: /approve/i }).click();
    // May need to confirm in a dialog
    const confirmButton = this.page.getByRole('button', { name: /confirm/i });
    if (await confirmButton.isVisible({ timeout: 2000 })) {
      await confirmButton.click();
    }
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Reject application (for reviewers)
   */
  async rejectApplication(reason?: string) {
    await this.page.getByRole('button', { name: /reject/i }).click();
    if (reason) {
      await this.page.getByPlaceholder(/reason/i).fill(reason);
    }
    const confirmButton = this.page.getByRole('button', { name: /confirm/i });
    await confirmButton.click();
    await this.page.waitForLoadState('networkidle');
  }
}
