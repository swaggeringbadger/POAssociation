import { test as base, expect } from '@playwright/test';
import { TestDataFactory } from '../utils/test-data';
import type { Page } from '@playwright/test';

/**
 * Authentication Fixtures
 *
 * Best Practices:
 * - Reuse authenticated states to speed up tests
 * - Provide role-based fixtures for different user types
 * - Automatically cleanup test data after each test
 * - Use storage state for authentication persistence
 */

export interface AuthFixtures {
  testDataFactory: TestDataFactory;
  authenticatedPage: Page;
  adminUser: { page: Page; userId: string; tenantId: string };
  homeownerUser: { page: Page; userId: string; tenantId: string };
  boardMemberUser: { page: Page; userId: string; tenantId: string };
}

export const test = base.extend<AuthFixtures>({
  /**
   * Test data factory - automatically cleans up after each test
   */
  testDataFactory: async ({}, use) => {
    const factory = new TestDataFactory();
    await use(factory);
    // Cleanup after test
    await factory.cleanup();
  },

  /**
   * Generic authenticated page
   */
  authenticatedPage: async ({ page, testDataFactory }, use) => {
    // Create test user and tenant
    const tenant = await testDataFactory.createTestTenant({
      name: 'Test Community',
      subdomain: `test-${Date.now()}`,
    });

    const user = await testDataFactory.createTestUser({
      email: `test-${Date.now()}@example.com`,
      firstName: 'Test',
      lastName: 'User',
    });

    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'homeowner');

    // Set up authentication via API or login flow
    // For demo mode, we'll use the demo code login
    await page.goto('/');

    // TODO: Implement actual login flow
    // This is a placeholder - adjust based on your auth mechanism

    await use(page);
  },

  /**
   * Admin user fixture - has full permissions
   */
  adminUser: async ({ browser, testDataFactory }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Create admin tenant and user
    const tenant = await testDataFactory.createTestTenant({
      name: 'Test Admin Community',
      subdomain: `admin-test-${Date.now()}`,
    });

    const user = await testDataFactory.createTestUser({
      email: `admin-${Date.now()}@example.com`,
      firstName: 'Admin',
      lastName: 'User',
    });

    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'account_admin');

    // Login as admin
    await page.goto('/');
    // TODO: Complete login flow

    await use({
      page,
      userId: user.id,
      tenantId: tenant.id,
    });

    await context.close();
  },

  /**
   * Homeowner user fixture - limited permissions
   */
  homeownerUser: async ({ browser, testDataFactory }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const tenant = await testDataFactory.createTestTenant({
      name: 'Test Homeowner Community',
      subdomain: `homeowner-test-${Date.now()}`,
    });

    const user = await testDataFactory.createTestUser({
      email: `homeowner-${Date.now()}@example.com`,
      firstName: 'Homeowner',
      lastName: 'User',
    });

    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'homeowner');

    await page.goto('/');
    // TODO: Complete login flow

    await use({
      page,
      userId: user.id,
      tenantId: tenant.id,
    });

    await context.close();
  },

  /**
   * Board member user fixture - reviewer permissions
   */
  boardMemberUser: async ({ browser, testDataFactory }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const tenant = await testDataFactory.createTestTenant({
      name: 'Test Board Community',
      subdomain: `board-test-${Date.now()}`,
    });

    const user = await testDataFactory.createTestUser({
      email: `board-${Date.now()}@example.com`,
      firstName: 'Board',
      lastName: 'Member',
    });

    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'poa_board_member');

    await page.goto('/');
    // TODO: Complete login flow

    await use({
      page,
      userId: user.id,
      tenantId: tenant.id,
    });

    await context.close();
  },
});

export { expect };
