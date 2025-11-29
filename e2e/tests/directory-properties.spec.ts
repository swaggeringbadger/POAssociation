import { test, expect } from '@playwright/test';
import { TestDataFactory } from '../utils/test-data';

/**
 * Directory and Properties E2E Tests
 *
 * Best Practices Applied:
 * - Test data browsing and search functionality
 * - Verify filtering and sorting
 * - Test CRUD operations on properties
 * - Use negative IDs for test data
 */

test.describe('Directory - User Directory', () => {
  let testDataFactory: TestDataFactory;

  test.beforeEach(async () => {
    testDataFactory = new TestDataFactory();
  });

  test.afterEach(async () => {
    await testDataFactory.cleanup();
  });

  test('should display user directory with all members', async ({ page }) => {
    // Create test community with multiple users
    const tenant = await testDataFactory.createTestTenant({
      name: 'Test Directory Community',
    });

    // Create multiple users
    const users = [];
    for (let i = 0; i < 5; i++) {
      const user = await testDataFactory.createTestUser({
        email: `user${i}@directory-test.com`,
        firstName: `User${i}`,
        lastName: `Test`,
      });
      await testDataFactory.createUserTenantRole(user.id, tenant.id, 'homeowner');
      users.push(user);
    }

    // Login as one of the users
    // TODO: Complete login flow

    await page.goto('/directory');

    // Verify directory page loads
    await expect(page).toHaveURL(/directory/i);

    // Verify users are displayed
    for (const user of users) {
      await expect(page.getByText(user.email)).toBeVisible();
    }
  });

  test('should search directory by name', async ({ page }) => {
    const tenant = await testDataFactory.createTestTenant();

    const user1 = await testDataFactory.createTestUser({
      email: 'alice@test.com',
      firstName: 'Alice',
      lastName: 'Smith',
    });
    await testDataFactory.createUserTenantRole(user1.id, tenant.id, 'homeowner');

    const user2 = await testDataFactory.createTestUser({
      email: 'bob@test.com',
      firstName: 'Bob',
      lastName: 'Jones',
    });
    await testDataFactory.createUserTenantRole(user2.id, tenant.id, 'homeowner');

    // TODO: Login

    await page.goto('/directory');

    // Search for Alice
    await page.getByPlaceholder(/search/i).fill('Alice');

    // Should only show Alice
    await expect(page.getByText('Alice Smith')).toBeVisible();
    await expect(page.getByText('Bob Jones')).not.toBeVisible({ timeout: 2000 });
  });

  test('should filter directory by role', async ({ page }) => {
    const tenant = await testDataFactory.createTestTenant();

    const homeowner = await testDataFactory.createTestUser({
      email: 'homeowner@test.com',
    });
    await testDataFactory.createUserTenantRole(homeowner.id, tenant.id, 'homeowner');

    const boardMember = await testDataFactory.createTestUser({
      email: 'board@test.com',
    });
    await testDataFactory.createUserTenantRole(boardMember.id, tenant.id, 'poa_board_member');

    // TODO: Login

    await page.goto('/directory');

    // Filter by board members
    await page.getByLabel(/role/i).selectOption('poa_board_member');

    // Should only show board members
    await expect(page.getByText('board@test.com')).toBeVisible();
    await expect(page.getByText('homeowner@test.com')).not.toBeVisible({ timeout: 2000 });
  });

  test('should display user contact information', async ({ page }) => {
    const tenant = await testDataFactory.createTestTenant();

    const user = await testDataFactory.createTestUser({
      email: 'contact@test.com',
      firstName: 'Contact',
      lastName: 'Test',
      phoneNumber: '555-1234',
    });
    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'homeowner');

    // TODO: Login

    await page.goto('/directory');

    // Click on user to see details
    await page.getByText('Contact Test').click();

    // Verify contact info is displayed
    await expect(page.getByText('contact@test.com')).toBeVisible();
    await expect(page.getByText('555-1234')).toBeVisible();
  });

  test('should respect privacy settings for contact information', async ({ page }) => {
    // Test that users can hide their contact info if that feature exists
    const tenant = await testDataFactory.createTestTenant();

    const privateUser = await testDataFactory.createTestUser({
      email: 'private@test.com',
      phoneNumber: '555-9999',
    });
    await testDataFactory.createUserTenantRole(privateUser.id, tenant.id, 'homeowner');

    // TODO: Set privacy settings to hide phone number

    // TODO: Login as different user

    await page.goto('/directory');

    // Phone number should be hidden
    await expect(page.getByText('555-9999')).not.toBeVisible({ timeout: 2000 });
  });
});

test.describe('Properties - Property Management', () => {
  let testDataFactory: TestDataFactory;

  test.beforeEach(async () => {
    testDataFactory = new TestDataFactory();
  });

  test.afterEach(async () => {
    await testDataFactory.cleanup();
  });

  test('should display properties list', async ({ page }) => {
    const tenant = await testDataFactory.createTestTenant();
    const user = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'homeowner');

    // TODO: Login

    await page.goto('/properties');

    // Verify properties page loads
    await expect(page).toHaveURL(/properties/i);
  });

  test('admin should be able to add a new property', async ({ page }) => {
    const tenant = await testDataFactory.createTestTenant();
    const admin = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(admin.id, tenant.id, 'account_admin');

    // TODO: Login as admin

    await page.goto('/properties');

    // Click add property button
    await page.getByRole('button', { name: /add property/i }).click();

    // Fill in property details
    await page.getByLabel(/address/i).fill('123 New Property Lane');
    await page.getByLabel(/lot number/i).fill('LOT-001');
    await page.getByLabel(/parcel id/i).fill('PARCEL-123');

    // Save property
    await page.getByRole('button', { name: /save|create/i }).click();

    // Verify property was added
    await expect(page.getByText('123 New Property Lane')).toBeVisible({ timeout: 5000 });
  });

  test('should search properties by address', async ({ page }) => {
    const tenant = await testDataFactory.createTestTenant();
    const user = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'homeowner');

    // TODO: Create some test properties via API

    // TODO: Login

    await page.goto('/properties');

    // Search for specific address
    await page.getByPlaceholder(/search/i).fill('Oak Street');

    // Should filter properties
    await expect(page.getByText(/oak street/i)).toBeVisible();
  });

  test('should view property details', async ({ page }) => {
    const tenant = await testDataFactory.createTestTenant();
    const user = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'homeowner');

    // TODO: Create test property

    // TODO: Login

    await page.goto('/properties');

    // Click on a property
    await page.getByText(/oak street/i).first().click();

    // Verify property details page
    await expect(page.getByText(/property details/i)).toBeVisible();
  });

  test('admin should be able to edit property information', async ({ page }) => {
    const tenant = await testDataFactory.createTestTenant();
    const admin = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(admin.id, tenant.id, 'account_admin');

    // TODO: Create test property
    // TODO: Login as admin

    await page.goto('/properties');

    // Find property and click edit
    await page.getByRole('button', { name: /edit/i }).first().click();

    // Modify property details
    await page.getByLabel(/address/i).fill('456 Updated Address');

    // Save changes
    await page.getByRole('button', { name: /save/i }).click();

    // Verify changes saved
    await expect(page.getByText('456 Updated Address')).toBeVisible({ timeout: 5000 });
  });

  test('should display owner information for properties', async ({ page }) => {
    const tenant = await testDataFactory.createTestTenant();
    const owner = await testDataFactory.createTestUser({
      email: 'owner@test.com',
      firstName: 'Property',
      lastName: 'Owner',
    });
    await testDataFactory.createUserTenantRole(owner.id, tenant.id, 'homeowner');

    // TODO: Create property associated with owner
    // TODO: Login

    await page.goto('/properties');

    // View property details
    // Should show owner information
    await expect(page.getByText('Property Owner')).toBeVisible();
    await expect(page.getByText('owner@test.com')).toBeVisible();
  });

  test('should display application history for a property', async ({ page }) => {
    const tenant = await testDataFactory.createTestTenant();
    const user = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'homeowner');

    // Create property and applications for it
    const application = await testDataFactory.createTestApplication(tenant.id, user.id, {
      propertyAddress: '789 History Lane',
      status: 'approved',
    });

    // TODO: Login

    await page.goto('/properties');

    // Find and click on the property
    await page.getByText('789 History Lane').click();

    // Should show application history
    await expect(page.getByText(/application.*history/i)).toBeVisible();
    await expect(page.getByText(/approved/i)).toBeVisible();
  });

  test('non-admin should not be able to edit properties', async ({ page }) => {
    const tenant = await testDataFactory.createTestTenant();
    const homeowner = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(homeowner.id, tenant.id, 'homeowner');

    // TODO: Login as homeowner

    await page.goto('/properties');

    // Edit button should not be visible or should be disabled
    const editButton = page.getByRole('button', { name: /edit/i });
    if (await editButton.isVisible({ timeout: 2000 })) {
      await expect(editButton).toBeDisabled();
    }
  });
});

test.describe('Properties - Map View', () => {
  let testDataFactory: TestDataFactory;

  test.beforeEach(async () => {
    testDataFactory = new TestDataFactory();
  });

  test.afterEach(async () => {
    await testDataFactory.cleanup();
  });

  test('should display properties on a map if available', async ({ page }) => {
    const tenant = await testDataFactory.createTestTenant();
    const user = await testDataFactory.createTestUser();
    await testDataFactory.createUserTenantRole(user.id, tenant.id, 'homeowner');

    // TODO: Login

    await page.goto('/properties');

    // Look for map view toggle
    const mapViewButton = page.getByRole('button', { name: /map view/i });
    if (await mapViewButton.isVisible({ timeout: 2000 })) {
      await mapViewButton.click();

      // Verify map loads
      await expect(page.locator('[data-testid="property-map"]')).toBeVisible({ timeout: 5000 });
    }
  });
});
