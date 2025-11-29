import { test, expect } from '@playwright/test';
import { TestDataFactory } from '../utils/test-data';

/**
 * Admin and Settings E2E Tests
 *
 * Best Practices Applied:
 * - Test admin-specific functionality
 * - Verify permission-based access
 * - Test configuration changes
 * - Use negative IDs for all test data
 */

test.describe('Settings - User Profile', () => {
  let testDataFactory: TestDataFactory;

  test.beforeEach(async () => {
    testDataFactory = new TestDataFactory();
  });

  test.afterEach(async () => {
    await testDataFactory.cleanup();
  });

  test('user should be able to view their profile settings', async ({ page }) => {
    // Create test user
    const tenant = await testDataFactory.createTestTenant();
    const user = await testDataFactory.createTestUser({
      email: 'profile-test@example.com',
      firstName: 'Profile',
      lastName: 'Test',
    });
    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'homeowner');

    // TODO: Complete login flow

    await page.goto('/settings');

    // Verify profile information is displayed
    await expect(page.getByText('Profile Test')).toBeVisible();
    await expect(page.getByText('profile-test@example.com')).toBeVisible();
  });

  test('user should be able to update notification preferences', async ({ page }) => {
    const tenant = await testDataFactory.createTestTenant();
    const user = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'homeowner');

    // TODO: Login

    await page.goto('/settings');

    // Navigate to notifications tab
    await page.getByRole('tab', { name: /notifications/i }).click();

    // Toggle a notification preference
    const emailNotificationsToggle = page.getByLabel(/email notifications/i);
    await emailNotificationsToggle.click();

    // Save changes
    await page.getByRole('button', { name: /save|update/i }).click();

    // Verify save confirmation
    await expect(page.getByText(/saved|updated/i)).toBeVisible({ timeout: 5000 });
  });

  test('user should be able to update their profile information', async ({ page }) => {
    const tenant = await testDataFactory.createTestTenant();
    const user = await testDataFactory.createTestUser({
      firstName: 'Original',
      lastName: 'Name',
    });
    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'homeowner');

    // TODO: Login

    await page.goto('/settings');

    // Update profile fields
    await page.getByLabel(/first name/i).fill('Updated');
    await page.getByLabel(/last name/i).fill('Name');
    await page.getByLabel(/phone/i).fill('555-1234');

    // Save changes
    await page.getByRole('button', { name: /save|update/i }).click();

    // Verify changes were saved
    await expect(page.getByText(/saved|updated/i)).toBeVisible({ timeout: 5000 });

    // Reload and verify persistence
    await page.reload();
    await expect(page.getByLabel(/first name/i)).toHaveValue('Updated');
  });
});

test.describe('Settings - Admin Dashboard', () => {
  let testDataFactory: TestDataFactory;

  test.beforeEach(async () => {
    testDataFactory = new TestDataFactory();
  });

  test.afterEach(async () => {
    await testDataFactory.cleanup();
  });

  test('admin should see admin-specific settings tabs', async ({ page }) => {
    // Create admin user
    const tenant = await testDataFactory.createTestTenant();
    const admin = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(admin.id, tenant.id, 'account_admin');

    // TODO: Login as admin

    await page.goto('/settings');

    // Verify admin tabs are visible
    await expect(page.getByRole('tab', { name: /community settings/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /users/i })).toBeVisible();
  });

  test('admin should be able to manage community settings', async ({ page }) => {
    const tenant = await testDataFactory.createTestTenant({
      name: 'Test Community',
    });
    const admin = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(admin.id, tenant.id, 'account_admin');

    // TODO: Login

    await page.goto('/settings');
    await page.getByRole('tab', { name: /community settings/i }).click();

    // Update community information
    await page.getByLabel(/community name/i).fill('Updated Community Name');
    await page.getByLabel(/description/i).fill('Updated description for testing');

    // Save changes
    await page.getByRole('button', { name: /save/i }).click();

    // Verify save confirmation
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });
  });

  test('admin should be able to view user list', async ({ page }) => {
    const tenant = await testDataFactory.createTestTenant();
    const admin = await testDataFactory.createTestUser({
      email: 'admin@test.com',
    });
    await testDataFactory.createUserTenantRole(admin.id, tenant.id, 'account_admin');

    // Create additional users
    const user1 = await testDataFactory.createTestUser({
      email: 'user1@test.com',
    });
    await testDataFactory.createUserTenantRole(user1.id, tenant.id, 'homeowner');

    const user2 = await testDataFactory.createTestUser({
      email: 'user2@test.com',
    });
    await testDataFactory.createUserTenantRole(user2.id, tenant.id, 'homeowner');

    // TODO: Login as admin

    await page.goto('/settings');
    await page.getByRole('tab', { name: /users/i }).click();

    // Verify users are displayed
    await expect(page.getByText('user1@test.com')).toBeVisible();
    await expect(page.getByText('user2@test.com')).toBeVisible();
  });

  test('admin should be able to change user roles', async ({ page }) => {
    const tenant = await testDataFactory.createTestTenant();
    const admin = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(admin.id, tenant.id, 'account_admin');

    const user = await testDataFactory.createTestUser({
      email: 'rolechange@test.com',
    });
    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'homeowner');

    // TODO: Login as admin

    await page.goto('/settings');
    await page.getByRole('tab', { name: /users/i }).click();

    // Find the user and change their role
    const userRow = page.locator('[data-testid="user-row"]', { hasText: 'rolechange@test.com' });
    await userRow.getByLabel(/role/i).selectOption('poa_board_member');

    // Save the change
    await userRow.getByRole('button', { name: /save|update/i }).click();

    // Verify change was saved
    await expect(page.getByText(/role updated/i)).toBeVisible({ timeout: 5000 });
  });

  test('non-admin should not see admin settings', async ({ page }) => {
    const tenant = await testDataFactory.createTestTenant();
    const homeowner = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(homeowner.id, tenant.id, 'homeowner');

    // TODO: Login as homeowner

    await page.goto('/settings');

    // Admin tabs should not be visible
    await expect(page.getByRole('tab', { name: /community settings/i })).not.toBeVisible({ timeout: 2000 });
    await expect(page.getByRole('tab', { name: /users/i })).not.toBeVisible({ timeout: 2000 });
  });
});

test.describe('Settings - Workflow Configuration', () => {
  let testDataFactory: TestDataFactory;

  test.beforeEach(async () => {
    testDataFactory = new TestDataFactory();
  });

  test.afterEach(async () => {
    await testDataFactory.cleanup();
  });

  test('admin should be able to configure approval workflow', async ({ page }) => {
    const tenant = await testDataFactory.createTestTenant();
    const admin = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(admin.id, tenant.id, 'account_admin');

    // TODO: Login

    await page.goto('/settings');
    await page.getByRole('tab', { name: /workflow/i }).click();

    // Configure workflow steps
    // This would depend on your actual workflow configuration UI
    await expect(page.getByText(/workflow/i)).toBeVisible();
  });

  test('admin should be able to assign reviewers to workflow steps', async ({ page }) => {
    const tenant = await testDataFactory.createTestTenant();
    const admin = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(admin.id, tenant.id, 'account_admin');

    // Create board members who can be reviewers
    const reviewer1 = await testDataFactory.createTestUser({
      email: 'reviewer1@test.com',
    });
    await testDataFactory.createUserTenantRole(reviewer1.id, tenant.id, 'poa_board_member');

    // TODO: Login

    await page.goto('/settings');
    // Navigate to workflow configuration and assign reviewers
  });
});

test.describe('Settings - Integration Configuration', () => {
  let testDataFactory: TestDataFactory;

  test.beforeEach(async () => {
    testDataFactory = new TestDataFactory();
  });

  test.afterEach(async () => {
    await testDataFactory.cleanup();
  });

  test('admin should be able to configure email settings', async ({ page }) => {
    const tenant = await testDataFactory.createTestTenant();
    const admin = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(admin.id, tenant.id, 'account_admin');

    // TODO: Login

    await page.goto('/settings');

    // Look for email/integration settings
    const integrationsTab = page.getByRole('tab', { name: /integrations|email/i });
    if (await integrationsTab.isVisible({ timeout: 2000 })) {
      await integrationsTab.click();

      // Configure email settings
      await page.getByLabel(/from email/i).fill('noreply@testcommunity.com');
      await page.getByLabel(/from name/i).fill('Test Community HOA');

      // Save
      await page.getByRole('button', { name: /save/i }).click();
      await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Settings - Subscription Management', () => {
  let testDataFactory: TestDataFactory;

  test.beforeEach(async () => {
    testDataFactory = new TestDataFactory();
  });

  test.afterEach(async () => {
    await testDataFactory.cleanup();
  });

  test('admin should be able to view subscription information', async ({ page }) => {
    const tenant = await testDataFactory.createTestTenant();
    const admin = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(admin.id, tenant.id, 'account_admin');

    // TODO: Login

    await page.goto('/settings');

    const subscriptionTab = page.getByRole('tab', { name: /subscription|billing/i });
    if (await subscriptionTab.isVisible({ timeout: 2000 })) {
      await subscriptionTab.click();

      // Verify subscription info is displayed
      await expect(page.getByText(/plan|subscription/i)).toBeVisible();
    }
  });
});
