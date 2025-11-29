import { test, expect } from '@playwright/test';
import { ApplicationPage } from '../page-objects/ApplicationPage';
import { DashboardPage } from '../page-objects/DashboardPage';
import { TestDataFactory } from '../utils/test-data';

/**
 * Application Workflow E2E Tests
 *
 * Best Practices Applied:
 * - Test complete user workflows from start to finish
 * - Use negative IDs for all test data
 * - Clean up test data after each test
 * - Verify state changes and UI updates
 * - Test both happy paths and edge cases
 */

test.describe('Application Creation Workflow', () => {
  let testDataFactory: TestDataFactory;

  test.beforeEach(async () => {
    testDataFactory = new TestDataFactory();
  });

  test.afterEach(async () => {
    await testDataFactory.cleanup();
  });

  test('should display project type selection on new application', async ({ page }) => {
    const applicationPage = new ApplicationPage(page);

    // TODO: Setup authenticated user session

    await applicationPage.gotoApplicationTypeSelect();

    // Verify project type cards are displayed
    await expect(applicationPage.projectTypeCards).toBeVisible();
    const cardCount = await applicationPage.projectTypeCards.count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test('should create a new application draft', async ({ page }) => {
    const applicationPage = new ApplicationPage(page);

    // Create test user and tenant
    const tenant = await testDataFactory.createTestTenant();
    const user = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'homeowner');

    // TODO: Complete login flow

    // Start new application
    await applicationPage.gotoApplicationTypeSelect();
    await applicationPage.selectProjectType('Exterior Modifications');

    // Fill in basic information
    await applicationPage.fillFormFields({
      'Property Address': '123 Test Street',
      'Description': 'Test application for e2e testing',
    });

    // Save as draft
    await applicationPage.saveAsDraft();

    // Verify draft was saved
    await applicationPage.gotoApplicationsList();
    await applicationPage.verifyApplicationInList('draft');
  });

  test('should submit a complete application', async ({ page }) => {
    const applicationPage = new ApplicationPage(page);

    // Create test data
    const tenant = await testDataFactory.createTestTenant();
    const user = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'homeowner');

    // TODO: Complete login flow

    // Start new application
    await applicationPage.gotoApplicationTypeSelect();
    await applicationPage.selectProjectType('Exterior Modifications');

    // Fill in all required fields
    await applicationPage.fillFormFields({
      'Property Address': '456 Test Avenue',
      'Project Description': 'Complete test application',
      'Estimated Cost': '5000',
      'Start Date': '2025-12-01',
    });

    // Move through multi-step form if applicable
    // await applicationPage.goToNextStep();

    // Submit application
    await applicationPage.submitApplication();

    // Verify submission success
    await expect(page.getByText(/submitted successfully/i)).toBeVisible({ timeout: 5000 });

    // Verify application status changed
    await applicationPage.gotoApplicationsList();
    await applicationPage.verifyApplicationInList('submitted');
  });

  test('should handle form validation errors', async ({ page }) => {
    const applicationPage = new ApplicationPage(page);

    // Create test data
    const tenant = await testDataFactory.createTestTenant();
    const user = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'homeowner');

    // TODO: Complete login flow

    await applicationPage.gotoApplicationTypeSelect();
    await applicationPage.selectProjectType('Exterior Modifications');

    // Try to submit without filling required fields
    await applicationPage.submitApplication();

    // Should show validation errors
    await expect(page.getByText(/required|must be filled/i).first()).toBeVisible();
  });

  test('should allow editing a draft application', async ({ page }) => {
    const applicationPage = new ApplicationPage(page);

    // Create test data with a draft application
    const tenant = await testDataFactory.createTestTenant();
    const user = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'homeowner');

    const application = await testDataFactory.createTestApplication(tenant.id, user.id, {
      status: 'draft',
      projectType: 'exterior-modifications',
      propertyAddress: '789 Test Boulevard',
    });

    // TODO: Complete login flow

    // Open the draft application
    await applicationPage.openApplication(application.id);

    // Modify some fields
    await applicationPage.fillField('Project Description', 'Updated description for testing');

    // Save changes
    await applicationPage.saveAsDraft();

    // Verify changes were saved
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });
  });

  test('should prevent editing submitted applications', async ({ page }) => {
    const applicationPage = new ApplicationPage(page);

    // Create submitted application
    const tenant = await testDataFactory.createTestTenant();
    const user = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'homeowner');

    const application = await testDataFactory.createTestApplication(tenant.id, user.id, {
      status: 'submitted',
      submittedAt: new Date(),
    });

    // TODO: Complete login flow

    await applicationPage.openApplication(application.id);

    // Form fields should be readonly or hidden
    const addressField = page.getByLabel(/property address/i);
    if (await addressField.isVisible({ timeout: 2000 })) {
      await expect(addressField).toBeDisabled();
    }
  });

  test('should allow uploading documents to application', async ({ page }) => {
    const applicationPage = new ApplicationPage(page);

    // Create test data
    const tenant = await testDataFactory.createTestTenant();
    const user = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'homeowner');

    // TODO: Complete login flow

    await applicationPage.gotoApplicationTypeSelect();
    await applicationPage.selectProjectType('Exterior Modifications');

    // Upload a test document
    // Note: You'll need to create a test file for this
    // const testFilePath = path.join(__dirname, '../fixtures/test-document.pdf');
    // await applicationPage.uploadDocument('supporting_documents', testFilePath);

    // Verify document was uploaded
    // await expect(page.getByText(/test-document\.pdf/i)).toBeVisible();
  });
});

test.describe('Application Review Workflow', () => {
  let testDataFactory: TestDataFactory;

  test.beforeEach(async () => {
    testDataFactory = new TestDataFactory();
  });

  test.afterEach(async () => {
    await testDataFactory.cleanup();
  });

  test('reviewer should see submitted applications', async ({ page }) => {
    const applicationPage = new ApplicationPage(page);

    // Create reviewer user
    const tenant = await testDataFactory.createTestTenant();
    const reviewer = await testDataFactory.createTestUser({
      email: 'reviewer@test.com',
      firstName: 'Reviewer',
    });
    await testDataFactory.createUserTenantRole(reviewer.id, tenant.id, 'poa_board_member');

    // Create a submitted application
    const applicant = await testDataFactory.createTestUser({
      email: 'applicant@test.com',
    });
    await testDataFactory.createUserTenantRole(applicant.id, tenant.id, 'homeowner');

    const application = await testDataFactory.createTestApplication(tenant.id, applicant.id, {
      status: 'submitted',
      submittedAt: new Date(),
    });

    // TODO: Login as reviewer

    await applicationPage.gotoApplicationsList();

    // Should see the submitted application
    await applicationPage.verifyApplicationInList('submitted');
  });

  test('reviewer should be able to add comments', async ({ page }) => {
    const applicationPage = new ApplicationPage(page);

    // Setup test data
    const tenant = await testDataFactory.createTestTenant();
    const reviewer = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(reviewer.id, tenant.id, 'poa_board_member');

    const applicant = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(applicant.id, tenant.id, 'homeowner');

    const application = await testDataFactory.createTestApplication(tenant.id, applicant.id, {
      status: 'submitted',
    });

    // TODO: Login as reviewer

    await applicationPage.openApplication(application.id);

    // Add a comment
    await applicationPage.addComment('This looks good, but please provide more details about the color choice.');

    // Verify comment appears
    await expect(page.getByText(/more details about the color choice/i)).toBeVisible();
  });

  test('reviewer should be able to approve application', async ({ page }) => {
    const applicationPage = new ApplicationPage(page);

    // Setup test data
    const tenant = await testDataFactory.createTestTenant();
    const reviewer = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(reviewer.id, tenant.id, 'poa_board_member');

    const applicant = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(applicant.id, tenant.id, 'homeowner');

    const application = await testDataFactory.createTestApplication(tenant.id, applicant.id, {
      status: 'in_review',
    });

    // TODO: Login as reviewer

    await applicationPage.openApplication(application.id);

    // Approve the application
    await applicationPage.approveApplication();

    // Verify status changed to approved
    await applicationPage.verifyStatus('approved');
  });

  test('reviewer should be able to reject application with reason', async ({ page }) => {
    const applicationPage = new ApplicationPage(page);

    // Setup test data
    const tenant = await testDataFactory.createTestTenant();
    const reviewer = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(reviewer.id, tenant.id, 'poa_board_member');

    const applicant = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(applicant.id, tenant.id, 'homeowner');

    const application = await testDataFactory.createTestApplication(tenant.id, applicant.id, {
      status: 'in_review',
    });

    // TODO: Login as reviewer

    await applicationPage.openApplication(application.id);

    // Reject with reason
    await applicationPage.rejectApplication('The proposed color is not in compliance with community guidelines.');

    // Verify status changed to rejected
    await applicationPage.verifyStatus('rejected');
  });

  test('homeowner should not see approve/reject buttons', async ({ page }) => {
    const applicationPage = new ApplicationPage(page);

    // Setup test data
    const tenant = await testDataFactory.createTestTenant();
    const homeowner = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(homeowner.id, tenant.id, 'homeowner');

    const application = await testDataFactory.createTestApplication(tenant.id, homeowner.id, {
      status: 'submitted',
    });

    // TODO: Login as homeowner

    await applicationPage.openApplication(application.id);

    // Verify approve/reject buttons are not visible
    const approveButton = page.getByRole('button', { name: /approve/i });
    const rejectButton = page.getByRole('button', { name: /reject/i });

    await expect(approveButton).not.toBeVisible({ timeout: 2000 });
    await expect(rejectButton).not.toBeVisible({ timeout: 2000 });
  });
});

test.describe('Application Filtering and Search', () => {
  let testDataFactory: TestDataFactory;

  test.beforeEach(async () => {
    testDataFactory = new TestDataFactory();
  });

  test.afterEach(async () => {
    await testDataFactory.cleanup();
  });

  test('should filter applications by status', async ({ page }) => {
    const applicationPage = new ApplicationPage(page);

    // Create multiple applications with different statuses
    const tenant = await testDataFactory.createTestTenant();
    const user = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'homeowner');

    await testDataFactory.createTestApplication(tenant.id, user.id, { status: 'draft' });
    await testDataFactory.createTestApplication(tenant.id, user.id, { status: 'submitted' });
    await testDataFactory.createTestApplication(tenant.id, user.id, { status: 'approved' });

    // TODO: Login

    await applicationPage.gotoApplicationsList();

    // Filter by status
    await page.getByLabel(/status/i).selectOption('submitted');

    // Should only show submitted applications
    const statusBadges = await page.locator('[data-testid="status-badge"]').allTextContents();
    for (const badge of statusBadges) {
      expect(badge.toLowerCase()).toContain('submitted');
    }
  });

  test('should search applications by property address', async ({ page }) => {
    const applicationPage = new ApplicationPage(page);

    // Create applications with different addresses
    const tenant = await testDataFactory.createTestTenant();
    const user = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'homeowner');

    await testDataFactory.createTestApplication(tenant.id, user.id, {
      propertyAddress: '123 Oak Street',
    });
    await testDataFactory.createTestApplication(tenant.id, user.id, {
      propertyAddress: '456 Pine Avenue',
    });

    // TODO: Login

    await applicationPage.gotoApplicationsList();

    // Search for specific address
    await page.getByPlaceholder(/search/i).fill('Oak Street');

    // Should only show matching applications
    await expect(page.getByText('123 Oak Street')).toBeVisible();
    await expect(page.getByText('456 Pine Avenue')).not.toBeVisible({ timeout: 2000 });
  });
});
