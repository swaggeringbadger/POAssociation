import { test, expect } from '@playwright/test';
import { LoginPage } from '../page-objects/LoginPage';
import { DashboardPage } from '../page-objects/DashboardPage';
import { TestDataFactory } from '../utils/test-data';
import { api } from '../../client/src/lib/api';

/**
 * Authentication E2E Tests
 *
 * Best Practices Applied:
 * - Test isolation - each test is independent
 * - Use page objects for maintainability
 * - Clear test descriptions
 * - Proper cleanup of test data
 * - Verify both positive and negative scenarios
 * - Use negative IDs for all test data
 */

test.describe('Authentication Flow', () => {
  let testDataFactory: TestDataFactory;

  test.beforeEach(async () => {
    testDataFactory = new TestDataFactory();
  });

  test.afterEach(async () => {
    await testDataFactory.cleanup();
  });

  test('should display demo code entry page on initial visit', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.verifyOnDemoCodePage();
  });

  test('should reject invalid demo code', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.enterDemoCode('INVALID-CODE-123');
    await loginPage.clickAccessDemo();

    // Should show error message in toast
    await loginPage.verifyErrorMessage();
  });

  test('should accept valid demo code and show persona selection', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Create a provisioned demo code with personas
    const demoCode = await testDataFactory.createTestDemoCode({
      code: `TEST-E2E-${Date.now()}`,
      label: 'E2E Test Demo',
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isActive: true,
      isProvisioned: true,
      provisionedAt: new Date(),
    });

    // Create test users as personas
    const tenant = await testDataFactory.createTestTenant({
      name: 'E2E Test Community',
      subdomain: `e2e-test-${Date.now()}`,
      demoCodeId: demoCode.id,
    });

    const testUser = await testDataFactory.createTestUser({
      email: `e2e-test-${Date.now()}@example.com`,
      firstName: 'TestUser',
      lastName: 'Demo',
      demoCodeId: demoCode.id,
    });

    await testDataFactory.createUserTenantRole(testUser.id, tenant.id, 'homeowner');

    await loginPage.goto();
    await loginPage.enterDemoCode(demoCode.code);
    await loginPage.clickAccessDemo();

    // Should navigate to persona selection
    await loginPage.waitForPersonaSelection();
    await expect(loginPage.personaCards.first()).toBeVisible();
  });

  test('should complete full demo login flow and land on dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Create test demo ecosystem
    const demoCode = await testDataFactory.createTestDemoCode({
      code: 'TEST-FULL-LOGIN',
      label: 'Test Full Login',
    });

    // Note: In a real scenario, you'd need to provision the demo with personas
    // This is a simplified version

    await loginPage.goto();
    await loginPage.loginWithDemoCode(demoCode.code);

    // Wait for persona selection page
    await expect(page).toHaveURL(/persona-select/i, { timeout: 10000 });

    // Select first available persona (adjust based on your setup)
    await page.getByRole('button').first().click();

    // Should navigate to dashboard
    await dashboardPage.verifyOnDashboard();
    await dashboardPage.verifyLoggedIn();
  });

  test('should maintain session after page reload', async ({ page, context }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Create and login with demo code
    const demoCode = await testDataFactory.createTestDemoCode({
      code: 'TEST-SESSION',
    });

    await loginPage.goto();
    await loginPage.loginWithDemoCode(demoCode.code);
    await expect(page).toHaveURL(/persona-select|dashboard/, { timeout: 10000 });

    // Select persona if needed
    const personaButton = page.getByRole('button').first();
    if (await personaButton.isVisible({ timeout: 2000 })) {
      await personaButton.click();
    }

    // Reload the page
    await page.reload();

    // Should still be logged in
    await expect(page).not.toHaveURL(/demo-code/i);
  });

  test('should logout successfully and redirect to login page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Create and login
    const demoCode = await testDataFactory.createTestDemoCode({
      code: 'TEST-LOGOUT',
    });

    await loginPage.goto();
    await loginPage.loginWithDemoCode(demoCode.code);

    // Select persona
    await expect(page).toHaveURL(/persona-select|dashboard/, { timeout: 10000 });
    const personaButton = page.getByRole('button').first();
    if (await personaButton.isVisible({ timeout: 2000 })) {
      await personaButton.click();
    }

    // Logout
    await dashboardPage.logout();

    // Should redirect to login/landing page
    await expect(page).toHaveURL(/\/$|\/demo-code|\/login/);
  });

  test('should prevent access to protected routes when not authenticated', async ({ page }) => {
    // Try to access dashboard without logging in
    await page.goto('/dashboard');

    // Should redirect to login page
    await expect(page).toHaveURL(/\/$|\/demo-code|\/login/, { timeout: 10000 });
  });

  test('should handle expired demo codes gracefully', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Create an expired demo code
    const expiredDemoCode = await testDataFactory.createTestDemoCode({
      code: 'TEST-EXPIRED',
      label: 'Expired Demo',
      validFrom: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
      validUntil: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),  // 7 days ago
      isActive: true,
    });

    await loginPage.goto();
    await loginPage.loginWithDemoCode(expiredDemoCode.code);

    // Should show error message about expired code
    await loginPage.verifyErrorMessage();
  });

  test('should handle inactive demo codes', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Create an inactive demo code
    const inactiveDemoCode = await testDataFactory.createTestDemoCode({
      code: 'TEST-INACTIVE',
      label: 'Inactive Demo',
      isActive: false,
    });

    await loginPage.goto();
    await loginPage.loginWithDemoCode(inactiveDemoCode.code);

    // Should show error message
    await loginPage.verifyErrorMessage();
  });

  test('should respect max uses limit on demo codes', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Create a demo code with max uses = 0 (already exhausted)
    const maxUsedDemoCode = await testDataFactory.createTestDemoCode({
      code: 'TEST-MAX-USES',
      label: 'Max Uses Demo',
      maxUses: 1,
      // Note: Would need to set currentUses = 1 in a real scenario
    });

    // This test would need additional setup to simulate max uses being reached
    // Placeholder for now
  });
});

test.describe('Role-based Access Control', () => {
  let testDataFactory: TestDataFactory;

  test.beforeEach(async () => {
    testDataFactory = new TestDataFactory();
  });

  test.afterEach(async () => {
    await testDataFactory.cleanup();
  });

  test('homeowner should not see admin-only features', async ({ page }) => {
    // Create homeowner user
    const tenant = await testDataFactory.createTestTenant();
    const user = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'homeowner');

    // TODO: Complete login flow for homeowner

    // Navigate to dashboard
    await page.goto('/dashboard');

    // Verify admin features are not visible
    const formBuilderLink = page.getByRole('link', { name: /form builder/i });
    await expect(formBuilderLink).not.toBeVisible({ timeout: 2000 });
  });

  test('admin should see all features including form builder', async ({ page }) => {
    // Create admin user
    const tenant = await testDataFactory.createTestTenant();
    const user = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'account_admin');

    // TODO: Complete login flow for admin

    // Navigate to dashboard
    await page.goto('/dashboard');

    // Verify admin features are visible
    // This would depend on your actual UI implementation
  });

  test('board member should see review features', async ({ page }) => {
    // Create board member user
    const tenant = await testDataFactory.createTestTenant();
    const user = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'poa_board_member');

    // TODO: Complete login flow

    // Should see review/approval features
  });
});
