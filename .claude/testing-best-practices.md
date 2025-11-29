# E2E Testing Best Practices

This document outlines the best practices for end-to-end testing in this project using Playwright.

## Last Updated
2025-11-28

## Test Data Management

### Negative Primary Keys for Test Data

**Critical Best Practice**: Always use **negative numbers** as primary keys for all test data.

#### Why Use Negative IDs?

1. **Easy Identification**: Negative IDs make test data instantly recognizable in the database
2. **No Conflicts**: Prevents conflicts with production or real data (which uses positive IDs)
3. **Simple Cleanup**: Enables bulk cleanup with queries like `DELETE WHERE id < 0`
4. **Debugging Aid**: Makes troubleshooting easier - if you see a negative ID, you know it's test data
5. **CI/CD Safety**: Prevents test data from polluting production databases

#### Implementation

```typescript
// Counter for generating unique negative IDs
let testIdCounter = -1;

export function generateTestId(): number {
  return testIdCounter--;
}

// Usage in tests
const testUserId = generateTestId(); // Returns -1, -2, -3, etc.
```

#### Examples

```typescript
// Creating test user with negative ID
const userData = {
  id: `test-user-${Math.abs(generateTestId())}`, // "test-user-1", "test-user-2", etc.
  email: 'test@example.com',
  // ... other fields
};

// Creating test application with negative ID
const applicationData = {
  id: generateTestId(), // -1, -2, -3, etc.
  // ... other fields
};
```

### Test Data Factory Pattern

Use the `TestDataFactory` class to create all test data. This provides:

- **Automatic Cleanup**: Tracks all created entities and cleans them up after tests
- **Consistent IDs**: Uses negative ID pattern for all test data
- **Reusability**: Common test scenarios encapsulated in factory methods
- **Isolation**: Each test gets fresh data without interference

```typescript
test.describe('My Feature', () => {
  let testDataFactory: TestDataFactory;

  test.beforeEach(async () => {
    testDataFactory = new TestDataFactory();
  });

  test.afterEach(async () => {
    await testDataFactory.cleanup(); // Automatically removes all test data
  });

  test('should do something', async ({ page }) => {
    const user = await testDataFactory.createTestUser();
    const tenant = await testDataFactory.createTestTenant();
    // Test logic here...
  });
});
```

## Test Organization

### File Structure

```
e2e/
├── fixtures/
│   └── auth-fixtures.ts        # Authentication fixtures for different roles
├── page-objects/
│   ├── LoginPage.ts            # Page object for login
│   ├── DashboardPage.ts        # Page object for dashboard
│   ├── ApplicationPage.ts      # Page object for applications
│   └── FormBuilderPage.ts      # Page object for form builder
├── tests/
│   ├── auth.spec.ts            # Authentication tests
│   ├── application-workflow.spec.ts
│   ├── form-builder.spec.ts
│   ├── admin-settings.spec.ts
│   └── directory-properties.spec.ts
└── utils/
    └── test-data.ts            # Test data factory and utilities
```

### Page Object Model (POM)

Always use Page Object Model to:
- Encapsulate page interactions
- Improve test maintainability
- Reduce code duplication
- Make tests more readable

```typescript
// Good - Using Page Object
const loginPage = new LoginPage(page);
await loginPage.goto();
await loginPage.loginWithDemoCode('TEST-CODE');

// Bad - Direct interactions in test
await page.goto('/');
await page.getByPlaceholder('Enter demo code').fill('TEST-CODE');
await page.getByRole('button', { name: 'Continue' }).click();
```

## Test Isolation

### Independent Tests

Each test should be completely independent:

```typescript
test.describe('Feature Tests', () => {
  let testDataFactory: TestDataFactory;

  // Fresh factory for each test
  test.beforeEach(async () => {
    testDataFactory = new TestDataFactory();
  });

  // Clean up after each test
  test.afterEach(async () => {
    await testDataFactory.cleanup();
  });
});
```

### Avoid Test Dependencies

```typescript
// Bad - Tests depend on each other
test('create user', async () => { /* creates user */ });
test('login user', async () => { /* assumes user from previous test exists */ });

// Good - Each test is self-contained
test('create user', async () => {
  const user = await testDataFactory.createTestUser();
  // Test logic...
  // Cleanup happens automatically
});

test('login user', async () => {
  const user = await testDataFactory.createTestUser(); // Creates its own user
  // Test logic...
});
```

## Assertions and Waits

### Use Explicit Waits

```typescript
// Good - Explicit wait with timeout
await expect(page.getByText('Success')).toBeVisible({ timeout: 5000 });

// Bad - Implicit wait
await page.waitForTimeout(5000);
```

### Wait for Network Idle

```typescript
// After navigation or form submission
await page.waitForLoadState('networkidle');
```

### Test Both Positive and Negative Cases

```typescript
// Positive case
test('should accept valid demo code', async ({ page }) => {
  const demoCode = await testDataFactory.createTestDemoCode();
  await loginPage.loginWithDemoCode(demoCode.code);
  await expect(page).toHaveURL(/persona-select/);
});

// Negative case
test('should reject invalid demo code', async ({ page }) => {
  await loginPage.loginWithDemoCode('INVALID-CODE');
  await loginPage.verifyErrorMessage();
});
```

## Naming Conventions

### Test Descriptions

Use clear, descriptive test names:

```typescript
// Good
test('should display validation error when submitting form without required fields', ...)
test('admin should be able to approve submitted applications', ...)

// Bad
test('form validation', ...)
test('approve', ...)
```

### Test Data Naming

```typescript
// Prefix all test data for easy identification
const testEmail = `test-${Date.now()}@example.com`;
const testTenantSubdomain = `test-${Date.now()}`;
const testDemoCode = `TEST-${Date.now()}-${randomString}`;
```

## Performance Best Practices

### Parallel Test Execution

Configure Playwright to run tests in parallel:

```typescript
// playwright.config.ts
export default defineConfig({
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
});
```

### Reuse Authentication State

```typescript
// Use fixtures for authenticated contexts
export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page, testDataFactory }, use) => {
    // Setup authentication once
    // ...
    await use(page);
  },
});
```

### Minimize Test Data

Only create the minimum data needed for each test:

```typescript
// Good - Only creates what's needed
test('should display user profile', async ({ page }) => {
  const user = await testDataFactory.createTestUser();
  // Test logic...
});

// Bad - Creates unnecessary data
test('should display user profile', async ({ page }) => {
  const user = await testDataFactory.createTestUser();
  const tenant = await testDataFactory.createTestTenant(); // Not needed
  await testDataFactory.createTestApplication(tenant.id, user.id); // Not needed
  // Test logic...
});
```

## Error Handling and Debugging

### Screenshots on Failure

Configured in `playwright.config.ts`:

```typescript
use: {
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'on-first-retry',
}
```

### Descriptive Error Messages

```typescript
// Good
await expect(application.status).toBe('approved');

// Better - with custom message
await expect(application.status, 'Application should be approved after board review').toBe('approved');
```

## CI/CD Integration

### Environment-Specific Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5000',
  },
});
```

### Test Reports

Generate multiple report formats:

```typescript
reporter: [
  ['html', { outputFolder: 'playwright-report' }],
  ['list'],
  ['junit', { outputFile: 'test-results/junit.xml' }],
],
```

## Security Best Practices

### Never Commit Sensitive Data

```typescript
// Good - Generate dynamic test data
const demoCode = await testDataFactory.createTestDemoCode({
  code: `TEST-${Date.now()}`,
});

// Bad - Hardcoded credentials
const demoCode = 'REAL-DEMO-CODE-123';
```

### Clean Up Sensitive Data

```typescript
test.afterEach(async () => {
  await testDataFactory.cleanup(); // Always clean up
});
```

## Common Patterns

### Testing Form Workflows

```typescript
test('should complete multi-step form', async ({ page }) => {
  const applicationPage = new ApplicationPage(page);

  // Step 1
  await applicationPage.selectProjectType('Exterior Modifications');

  // Step 2
  await applicationPage.fillFormFields({
    'Property Address': '123 Test St',
    'Description': 'Test description',
  });

  // Step 3
  await applicationPage.submitApplication();

  // Verify
  await expect(page.getByText(/submitted successfully/i)).toBeVisible();
});
```

### Testing RBAC (Role-Based Access Control)

```typescript
test('admin should see admin features', async ({ page }) => {
  const admin = await testDataFactory.createTestUser();
  await testDataFactory.createUserTenantRole(admin.id, tenant.id, 'account_admin');
  // Login and verify admin features visible
});

test('homeowner should not see admin features', async ({ page }) => {
  const homeowner = await testDataFactory.createTestUser();
  await testDataFactory.createUserTenantRole(homeowner.id, tenant.id, 'homeowner');
  // Login and verify admin features NOT visible
});
```

### Testing Search and Filters

```typescript
test('should filter results by status', async ({ page }) => {
  // Create test data with different statuses
  await testDataFactory.createTestApplication(tenant.id, user.id, { status: 'draft' });
  await testDataFactory.createTestApplication(tenant.id, user.id, { status: 'submitted' });

  // Apply filter
  await page.getByLabel(/status/i).selectOption('submitted');

  // Verify only filtered results shown
  const badges = await page.locator('[data-testid="status-badge"]').allTextContents();
  expect(badges.every(b => b.toLowerCase().includes('submitted'))).toBe(true);
});
```

## Running Tests

### Local Development

```bash
# Run all tests
npx playwright test

# Run specific test file
npx playwright test e2e/tests/auth.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed

# Run in debug mode
npx playwright test --debug

# Run specific test by name
npx playwright test -g "should accept valid demo code"
```

### View Test Reports

```bash
# Open HTML report
npx playwright show-report
```

### Update Snapshots

```bash
npx playwright test --update-snapshots
```

## Maintenance

### Regular Cleanup

Periodically clean up orphaned test data:

```typescript
// Run in maintenance scripts
import { cleanupAllTestData } from './e2e/utils/test-data';

await cleanupAllTestData();
```

### Keep Tests Updated

- Update page objects when UI changes
- Add new tests for new features
- Remove tests for deprecated features
- Keep test data factories in sync with schema changes

## Quick Reference

### Must-Do Checklist for Every Test

- [ ] Use negative IDs for all test data
- [ ] Use TestDataFactory for data creation
- [ ] Clean up test data in afterEach
- [ ] Use Page Objects for UI interactions
- [ ] Make tests independent (no dependencies)
- [ ] Use explicit waits with timeouts
- [ ] Test both positive and negative cases
- [ ] Use descriptive test names
- [ ] Verify expected outcomes with assertions

### Common Gotchas

1. **Forgetting cleanup** - Always clean up test data
2. **Hardcoded waits** - Use explicit waits instead of `waitForTimeout`
3. **Shared state** - Each test should create its own data
4. **Brittle selectors** - Use semantic selectors (roles, labels) over CSS
5. **Missing error cases** - Always test failure scenarios
6. **Production data** - Never use positive IDs or real data in tests

## Additional Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Testing Library Guiding Principles](https://testing-library.com/docs/guiding-principles)
