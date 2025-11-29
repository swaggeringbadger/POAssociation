import { Page, Locator, expect } from '@playwright/test';

/**
 * Form Builder Page Object
 *
 * Handles form template creation and editing
 */
export class FormBuilderPage {
  readonly page: Page;
  readonly formNameInput: Locator;
  readonly formDescriptionInput: Locator;
  readonly addFieldButton: Locator;
  readonly addSectionButton: Locator;
  readonly fieldTypeSelector: Locator;
  readonly saveFormButton: Locator;
  readonly publishFormButton: Locator;
  readonly previewButton: Locator;
  readonly fieldsList: Locator;
  readonly sectionsList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.formNameInput = page.getByLabel(/form name/i);
    this.formDescriptionInput = page.getByLabel(/description/i);
    this.addFieldButton = page.getByRole('button', { name: /add field/i });
    this.addSectionButton = page.getByRole('button', { name: /add section/i });
    this.fieldTypeSelector = page.locator('[data-testid="field-type-selector"]');
    this.saveFormButton = page.getByRole('button', { name: /save/i });
    this.publishFormButton = page.getByRole('button', { name: /publish/i });
    this.previewButton = page.getByRole('button', { name: /preview/i });
    this.fieldsList = page.locator('[data-testid="fields-list"]');
    this.sectionsList = page.locator('[data-testid="sections-list"]');
  }

  /**
   * Navigate to form builder
   */
  async goto() {
    await this.page.goto('/form-builder');
  }

  /**
   * Navigate to edit existing form
   */
  async gotoEditForm(formId: string) {
    await this.page.goto(`/form-builder/${formId}`);
  }

  /**
   * Set form name
   */
  async setFormName(name: string) {
    await this.formNameInput.fill(name);
  }

  /**
   * Set form description
   */
  async setFormDescription(description: string) {
    await this.formDescriptionInput.fill(description);
  }

  /**
   * Add a new section to the form
   */
  async addSection(sectionName: string) {
    await this.addSectionButton.click();
    await this.page.getByLabel(/section name/i).fill(sectionName);
    await this.page.getByRole('button', { name: /confirm|add/i }).click();
  }

  /**
   * Add a field to the form
   */
  async addField(fieldType: string, fieldLabel: string, options?: {
    required?: boolean;
    placeholder?: string;
    helpText?: string;
  }) {
    await this.addFieldButton.click();

    // Select field type
    await this.page.getByRole('button', { name: new RegExp(fieldType, 'i') }).click();

    // Fill field label
    await this.page.getByLabel(/field label/i).fill(fieldLabel);

    // Set optional properties
    if (options?.required) {
      await this.page.getByLabel(/required/i).check();
    }

    if (options?.placeholder) {
      await this.page.getByLabel(/placeholder/i).fill(options.placeholder);
    }

    if (options?.helpText) {
      await this.page.getByLabel(/help text/i).fill(options.helpText);
    }

    // Confirm adding the field
    await this.page.getByRole('button', { name: /save|add field/i }).click();
  }

  /**
   * Drag and drop field to reorder
   */
  async reorderField(fromIndex: number, toIndex: number) {
    const fields = await this.fieldsList.locator('[data-testid="field-item"]').all();
    const fromField = fields[fromIndex];
    const toField = fields[toIndex];

    await fromField.dragTo(toField);
  }

  /**
   * Edit an existing field
   */
  async editField(fieldLabel: string, newLabel?: string) {
    await this.page.getByText(fieldLabel).click();
    if (newLabel) {
      await this.page.getByLabel(/field label/i).fill(newLabel);
    }
    await this.page.getByRole('button', { name: /save/i }).click();
  }

  /**
   * Delete a field
   */
  async deleteField(fieldLabel: string) {
    const fieldRow = this.page.locator('[data-testid="field-item"]', { hasText: fieldLabel });
    await fieldRow.getByRole('button', { name: /delete/i }).click();

    // Confirm deletion
    const confirmButton = this.page.getByRole('button', { name: /confirm|yes/i });
    if (await confirmButton.isVisible({ timeout: 2000 })) {
      await confirmButton.click();
    }
  }

  /**
   * Save form as draft
   */
  async saveForm() {
    await this.saveFormButton.click();
    await expect(this.page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });
  }

  /**
   * Publish form to make it active
   */
  async publishForm() {
    await this.publishFormButton.click();

    // Confirm publishing
    const confirmButton = this.page.getByRole('button', { name: /confirm|publish/i });
    if (await confirmButton.isVisible({ timeout: 2000 })) {
      await confirmButton.click();
    }

    await expect(this.page.getByText(/published/i)).toBeVisible({ timeout: 5000 });
  }

  /**
   * Preview the form
   */
  async previewForm() {
    await this.previewButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Verify field exists in the form
   */
  async verifyFieldExists(fieldLabel: string) {
    await expect(this.page.getByText(fieldLabel)).toBeVisible();
  }

  /**
   * Verify section exists in the form
   */
  async verifySectionExists(sectionName: string) {
    await expect(this.page.getByRole('heading', { name: new RegExp(sectionName, 'i') })).toBeVisible();
  }

  /**
   * Get total number of fields
   */
  async getFieldCount(): Promise<number> {
    return await this.fieldsList.locator('[data-testid="field-item"]').count();
  }

  /**
   * Set conditional logic for a field
   */
  async setConditionalLogic(fieldLabel: string, condition: {
    dependsOn: string;
    operator: string;
    value: string;
  }) {
    await this.page.getByText(fieldLabel).click();
    await this.page.getByRole('button', { name: /conditional logic/i }).click();

    await this.page.getByLabel(/depends on/i).selectOption(condition.dependsOn);
    await this.page.getByLabel(/operator/i).selectOption(condition.operator);
    await this.page.getByLabel(/value/i).fill(condition.value);

    await this.page.getByRole('button', { name: /save/i }).click();
  }
}
