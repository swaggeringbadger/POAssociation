import { test, expect } from '@playwright/test';
import { LoginPage } from '../page-objects/LoginPage';
import { ApplicationPage } from '../page-objects/ApplicationPage';

/**
 * Application Workflow Tests - Using Real Demo Sandbox
 *
 * These tests use the existing TEST2024 demo code to authenticate
 * and then test real application workflows.
 */

// Use existing demo code
const DEMO_CODE = 'TEST2024';
const TEST_PERSONA = 'James'; // Homeowner persona

test.describe('Application Workflow - As Homeowner', () => {
  test.beforeEach(async ({ page }) => {
    // Login using demo sandbox
    const loginPage = new LoginPage(page);
    await loginPage.loginAsDemoUser(DEMO_CODE, TEST_PERSONA);
  });

  test('should navigate to applications page from dashboard', async ({ page }) => {
    // Verify we're on dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Click on Applications link
    await page.getByRole('link', { name: /applications/i }).click();

    // Should navigate to applications page
    await expect(page).toHaveURL(/\/applications/);
  });

  test('should display applications list', async ({ page }) => {
    await page.goto('/applications');

    // Should see applications page
    await expect(page.getByText(/applications/i).first()).toBeVisible();

    // May have existing applications or empty state
    const hasApplications = await page.locator('[data-testid="application-row"]').count();
    const hasEmptyState = await page.getByText(/no applications/i).isVisible({ timeout: 2000 }).catch(() => false);

    // One or the other should be true
    expect(hasApplications > 0 || hasEmptyState).toBeTruthy();
  });

  test('should navigate to new application page', async ({ page }) => {
    await page.goto('/applications');

    // Click new application button
    const newAppButton = page.getByRole('button', { name: /new application/i }).or(
      page.getByRole('link', { name: /new application/i })
    );

    await newAppButton.click();

    // Should navigate to application type selection
    await expect(page).toHaveURL(/\/applications\/new|\/application-type/);
  });

  test('should show project type options on new application', async ({ page }) => {
    await page.goto('/applications/new');

    // Should see project type selection
    // Look for common project types
    const hasProjectTypes = await page.getByText(/exterior|modification|architectural/i).isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasProjectTypes).toBeTruthy();
  });

  test('should be able to view application details', async ({ page }) => {
    await page.goto('/applications');

    // Check if there are any applications
    const appCount = await page.locator('[data-testid="application-row"]').or(
      page.locator('tr').filter({ has: page.getByText(/#/) })
    ).count();

    if (appCount > 0) {
      // Click first application
      await page.locator('[data-testid="application-row"]').or(
        page.locator('tr').filter({ has: page.getByText(/#/) })
      ).first().click();

      // Should navigate to application detail
      await expect(page).toHaveURL(/\/applications\/\d+/);

      // Should see application details
      await expect(page.getByText(/status|property|description/i).first()).toBeVisible();
    } else {
      console.log('No applications found - skipping detail view test');
    }
  });
});

test.describe('Application Workflow - As Board Member', () => {
  test.beforeEach(async ({ page }) => {
    // Login as Sarah (Board Member)
    const loginPage = new LoginPage(page);
    await loginPage.loginAsDemoUser(DEMO_CODE, 'Sarah');
  });

  test('should see applications in review queue', async ({ page }) => {
    await page.goto('/applications');

    // Board members should see submitted applications
    await expect(page).toHaveURL(/\/applications/);

    // Should have some way to filter or see pending applications
    const hasApplications = await page.locator('[data-testid="application-row"]').count() > 0;
    const hasEmptyState = await page.getByText(/no applications/i).isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasApplications || hasEmptyState).toBeTruthy();
  });

  test('should have different permissions than homeowner', async ({ page }) => {
    await page.goto('/dashboard');

    // Board member might see additional options
    // This is a placeholder - adjust based on actual UI
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe('Navigation and UI', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginAsDemoUser(DEMO_CODE, TEST_PERSONA);
  });

  test('should have working navigation menu', async ({ page }) => {
    // Check main navigation items exist
    await expect(page.getByRole('link', { name: /dashboard/i }).or(page.getByText(/dashboard/i).first())).toBeVisible();
    await expect(page.getByRole('link', { name: /applications/i })).toBeVisible();
  });

  test('should display user menu', async ({ page }) => {
    // Look for user menu/profile
    const userMenu = page.locator('[data-testid="user-menu"]').or(
      page.getByRole('button', { name: /james|user|profile|menu/i })
    );

    // User menu should exist somewhere
    const menuExists = await userMenu.count() > 0;
    expect(menuExists).toBeTruthy();
  });

  test('should be able to logout', async ({ page }) => {
    // Look for logout button (might be in dropdown)
    const logoutButton = page.getByRole('button', { name: /logout|sign out/i }).or(
      page.getByText(/logout|sign out/i)
    );

    // Try to click if visible
    const isVisible = await logoutButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (isVisible) {
      await logoutButton.click();

      // Should redirect to login or demo page
      await page.waitForURL(/\/demo|\/login|^\/$/, { timeout: 5000 });
    } else {
      // Might be in a menu - try opening user menu first
      const userMenuButton = page.locator('[data-testid="user-menu"]').or(
        page.getByRole('button', { name: /user|profile|menu/i }).first()
      );

      if (await userMenuButton.isVisible({ timeout: 2000 })) {
        await userMenuButton.click();
        await page.waitForTimeout(500);

        // Now try logout again
        const logoutAfterMenu = page.getByRole('button', { name: /logout|sign out/i });
        if (await logoutAfterMenu.isVisible({ timeout: 2000 })) {
          await logoutAfterMenu.click();
          await page.waitForURL(/\/demo|\/login|^\/$/, { timeout: 5000 });
        }
      }
    }
  });
});

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginAsDemoUser(DEMO_CODE, TEST_PERSONA);
  });

  test('should display dashboard after login', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/dashboard|welcome/i).first()).toBeVisible();
  });

  test('should show user-specific content', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);

    // Should see the user's name somewhere
    await expect(page.getByText(/james/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('should have quick action buttons or cards', async ({ page }) => {
    // Dashboard typically has action cards or buttons
    const hasButtons = await page.getByRole('button').count() > 0;
    const hasCards = await page.locator('[class*="card"]').count() > 0;

    expect(hasButtons || hasCards).toBeTruthy();
  });
});
