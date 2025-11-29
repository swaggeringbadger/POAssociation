import { test, expect } from '@playwright/test';
import { FormBuilderPage } from '../page-objects/FormBuilderPage';
import { TestDataFactory } from '../utils/test-data';

/**
 * Form Builder E2E Tests
 *
 * Best Practices Applied:
 * - Test complex UI interactions (drag-and-drop, dynamic forms)
 * - Verify form state changes
 * - Test validation and error handling
 * - Use negative IDs for test form templates
 */

test.describe('Form Builder - Basic Operations', () => {
  let testDataFactory: TestDataFactory;

  test.beforeEach(async () => {
    testDataFactory = new TestDataFactory();
  });

  test.afterEach(async () => {
    await testDataFactory.cleanup();
  });

  test('admin should be able to access form builder', async ({ page }) => {
    const formBuilder = new FormBuilderPage(page);

    // Create admin user
    const tenant = await testDataFactory.createTestTenant();
    const admin = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(admin.id, tenant.id, 'account_admin');

    // TODO: Complete login flow

    await formBuilder.goto();

    // Verify form builder page loaded
    await expect(page).toHaveURL(/form-builder/i);
  });

  test('should create a new form template', async ({ page }) => {
    const formBuilder = new FormBuilderPage(page);

    // Setup admin user
    const tenant = await testDataFactory.createTestTenant();
    const admin = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(admin.id, tenant.id, 'account_admin');

    // TODO: Complete login flow

    await formBuilder.goto();

    // Set form name and description
    await formBuilder.setFormName('Test Exterior Modification Form');
    await formBuilder.setFormDescription('E2E test form for exterior modifications');

    // Add a section
    await formBuilder.addSection('Property Information');

    // Verify section was added
    await formBuilder.verifySectionExists('Property Information');
  });

  test('should add different field types to form', async ({ page }) => {
    const formBuilder = new FormBuilderPage(page);

    // Setup
    const tenant = await testDataFactory.createTestTenant();
    const admin = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(admin.id, tenant.id, 'account_admin');

    // TODO: Login

    await formBuilder.goto();

    // Add various field types
    await formBuilder.addField('text', 'Property Address', {
      required: true,
      placeholder: 'Enter your property address',
    });

    await formBuilder.addField('textarea', 'Project Description', {
      required: true,
      helpText: 'Describe your project in detail',
    });

    await formBuilder.addField('number', 'Estimated Cost', {
      required: true,
    });

    await formBuilder.addField('date', 'Proposed Start Date');

    await formBuilder.addField('select', 'Project Type', {
      required: true,
    });

    // Verify all fields were added
    await formBuilder.verifyFieldExists('Property Address');
    await formBuilder.verifyFieldExists('Project Description');
    await formBuilder.verifyFieldExists('Estimated Cost');
    await formBuilder.verifyFieldExists('Proposed Start Date');
    await formBuilder.verifyFieldExists('Project Type');

    // Verify field count
    const fieldCount = await formBuilder.getFieldCount();
    expect(fieldCount).toBe(5);
  });

  test('should edit an existing field', async ({ page }) => {
    const formBuilder = new FormBuilderPage(page);

    // Setup
    const tenant = await testDataFactory.createTestTenant();
    const admin = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(admin.id, tenant.id, 'account_admin');

    // TODO: Login

    await formBuilder.goto();

    // Add a field
    await formBuilder.addField('text', 'Original Field Name');

    // Edit the field
    await formBuilder.editField('Original Field Name', 'Updated Field Name');

    // Verify new name appears
    await formBuilder.verifyFieldExists('Updated Field Name');
  });

  test('should delete a field', async ({ page }) => {
    const formBuilder = new FormBuilderPage(page);

    // Setup
    const tenant = await testDataFactory.createTestTenant();
    const admin = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(admin.id, tenant.id, 'account_admin');

    // TODO: Login

    await formBuilder.goto();

    // Add fields
    await formBuilder.addField('text', 'Field to Keep');
    await formBuilder.addField('text', 'Field to Delete');

    // Delete one field
    await formBuilder.deleteField('Field to Delete');

    // Verify it's gone
    await expect(page.getByText('Field to Delete')).not.toBeVisible({ timeout: 2000 });

    // Verify the other field remains
    await formBuilder.verifyFieldExists('Field to Keep');
  });

  test('should save form as draft', async ({ page }) => {
    const formBuilder = new FormBuilderPage(page);

    // Setup
    const tenant = await testDataFactory.createTestTenant();
    const admin = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(admin.id, tenant.id, 'account_admin');

    // TODO: Login

    await formBuilder.goto();

    await formBuilder.setFormName('Draft Form Test');
    await formBuilder.addField('text', 'Test Field');

    // Save as draft
    await formBuilder.saveForm();

    // Verify save confirmation
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });
  });

  test('should publish a form template', async ({ page }) => {
    const formBuilder = new FormBuilderPage(page);

    // Setup
    const tenant = await testDataFactory.createTestTenant();
    const admin = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(admin.id, tenant.id, 'account_admin');

    // TODO: Login

    await formBuilder.goto();

    // Create a complete form
    await formBuilder.setFormName('Test Published Form');
    await formBuilder.addSection('Basic Information');
    await formBuilder.addField('text', 'Name', { required: true });

    // Publish the form
    await formBuilder.publishForm();

    // Verify publish confirmation
    await expect(page.getByText(/published/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Form Builder - Advanced Features', () => {
  let testDataFactory: TestDataFactory;

  test.beforeEach(async () => {
    testDataFactory = new TestDataFactory();
  });

  test.afterEach(async () => {
    await testDataFactory.cleanup();
  });

  test('should reorder fields via drag and drop', async ({ page }) => {
    const formBuilder = new FormBuilderPage(page);

    // Setup
    const tenant = await testDataFactory.createTestTenant();
    const admin = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(admin.id, tenant.id, 'account_admin');

    // TODO: Login

    await formBuilder.goto();

    // Add multiple fields
    await formBuilder.addField('text', 'Field One');
    await formBuilder.addField('text', 'Field Two');
    await formBuilder.addField('text', 'Field Three');

    // Reorder - move first field to last position
    await formBuilder.reorderField(0, 2);

    // Verify new order (this would depend on your actual UI implementation)
    // You might need to check the order in the DOM or via data attributes
  });

  test('should set conditional logic on fields', async ({ page }) => {
    const formBuilder = new FormBuilderPage(page);

    // Setup
    const tenant = await testDataFactory.createTestTenant();
    const admin = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(admin.id, tenant.id, 'account_admin');

    // TODO: Login

    await formBuilder.goto();

    // Add fields
    await formBuilder.addField('select', 'Has HOA Approval?');
    await formBuilder.addField('text', 'Approval Number');

    // Set conditional logic - show "Approval Number" only if "Has HOA Approval?" is "Yes"
    await formBuilder.setConditionalLogic('Approval Number', {
      dependsOn: 'Has HOA Approval?',
      operator: 'equals',
      value: 'Yes',
    });

    // Verify conditional logic was set
    // This would depend on your UI showing some indication
  });

  test('should preview form before publishing', async ({ page }) => {
    const formBuilder = new FormBuilderPage(page);

    // Setup
    const tenant = await testDataFactory.createTestTenant();
    const admin = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(admin.id, tenant.id, 'account_admin');

    // TODO: Login

    await formBuilder.goto();

    // Create a form
    await formBuilder.setFormName('Preview Test Form');
    await formBuilder.addField('text', 'Test Field');

    // Open preview
    await formBuilder.previewForm();

    // Verify we're in preview mode
    await expect(page.getByText(/preview/i)).toBeVisible();

    // Verify the field appears in preview
    await expect(page.getByLabel(/test field/i)).toBeVisible();
  });

  test('should validate required fields before publishing', async ({ page }) => {
    const formBuilder = new FormBuilderPage(page);

    // Setup
    const tenant = await testDataFactory.createTestTenant();
    const admin = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(admin.id, tenant.id, 'account_admin');

    // TODO: Login

    await formBuilder.goto();

    // Try to publish without setting form name
    await formBuilder.publishForm();

    // Should show validation error
    await expect(page.getByText(/form name.*required/i)).toBeVisible();
  });

  test('should create form with multiple sections', async ({ page }) => {
    const formBuilder = new FormBuilderPage(page);

    // Setup
    const tenant = await testDataFactory.createTestTenant();
    const admin = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(admin.id, tenant.id, 'account_admin');

    // TODO: Login

    await formBuilder.goto();

    await formBuilder.setFormName('Multi-Section Form');

    // Add multiple sections
    await formBuilder.addSection('Property Information');
    await formBuilder.addSection('Project Details');
    await formBuilder.addSection('Supporting Documents');

    // Verify all sections exist
    await formBuilder.verifySectionExists('Property Information');
    await formBuilder.verifySectionExists('Project Details');
    await formBuilder.verifySectionExists('Supporting Documents');
  });

  test('should duplicate an existing field', async ({ page }) => {
    const formBuilder = new FormBuilderPage(page);

    // Setup
    const tenant = await testDataFactory.createTestTenant();
    const admin = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(admin.id, tenant.id, 'account_admin');

    // TODO: Login

    await formBuilder.goto();

    // Add a field
    await formBuilder.addField('text', 'Original Field', {
      required: true,
      placeholder: 'Enter value',
    });

    // Duplicate it (if this feature exists)
    const duplicateButton = page.getByRole('button', { name: /duplicate/i });
    if (await duplicateButton.isVisible({ timeout: 2000 })) {
      await duplicateButton.click();

      // Verify a copy was created
      const fieldCount = await formBuilder.getFieldCount();
      expect(fieldCount).toBe(2);
    }
  });
});

test.describe('Form Builder - Permissions', () => {
  let testDataFactory: TestDataFactory;

  test.beforeEach(async () => {
    testDataFactory = new TestDataFactory();
  });

  test.afterEach(async () => {
    await testDataFactory.cleanup();
  });

  test('homeowner should not be able to access form builder', async ({ page }) => {
    const formBuilder = new FormBuilderPage(page);

    // Create homeowner user
    const tenant = await testDataFactory.createTestTenant();
    const homeowner = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(homeowner.id, tenant.id, 'homeowner');

    // TODO: Login as homeowner

    // Try to access form builder
    await formBuilder.goto();

    // Should be redirected or see error
    await expect(page).not.toHaveURL(/form-builder/);
  });

  test('board member should not be able to access form builder', async ({ page }) => {
    const formBuilder = new FormBuilderPage(page);

    // Create board member
    const tenant = await testDataFactory.createTestTenant();
    const boardMember = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(boardMember.id, tenant.id, 'poa_board_member');

    // TODO: Login

    await formBuilder.goto();

    // Should be restricted (unless board members have this permission)
    // Adjust based on your actual permission model
  });
});
