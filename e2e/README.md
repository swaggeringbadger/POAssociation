# E2E Test Suite

Comprehensive end-to-end test suite for the POA Association Portal using Playwright.

## Quick Start

### Install Dependencies

```bash
npm install
npx playwright install chromium
```

### Run Tests

```bash
# Run all tests
npm run test:e2e

# Run tests in headed mode
npm run test:e2e:headed

# Run tests in debug mode
npm run test:e2e:debug

# Run specific test file
npx playwright test e2e/tests/auth.spec.ts

# Run tests matching a pattern
npx playwright test -g "should login"
```

### View Reports

```bash
npm run test:e2e:report
```

## Test Structure

### Directory Layout

```
e2e/
├── fixtures/           # Test fixtures (authenticated contexts, etc.)
├── page-objects/       # Page Object Model classes
├── tests/             # Test specifications
│   ├── auth.spec.ts
│   ├── application-workflow.spec.ts
│   ├── form-builder.spec.ts
│   ├── admin-settings.spec.ts
│   └── directory-properties.spec.ts
└── utils/             # Test utilities and helpers
    └── test-data.ts   # Test data factory
```

## Key Concepts

### 1. Negative ID Pattern for Test Data

**All test data uses NEGATIVE primary keys** (-1, -2, -3, etc.)

**Why?**
- Easy to identify test data in the database
- No conflicts with production data
- Simple cleanup: `DELETE WHERE id < 0`
- Better debugging and troubleshooting

**Example:**
```typescript
const testUser = await testDataFactory.createTestUser();
// User will have ID like "test-user-1" or application will have ID like -1
```

### 2. Test Data Factory

The `TestDataFactory` class handles all test data creation and cleanup:

```typescript
test.describe('My Tests', () => {
  let testDataFactory: TestDataFactory;

  test.beforeEach(async () => {
    testDataFactory = new TestDataFactory();
  });

  test.afterEach(async () => {
    await testDataFactory.cleanup(); // Automatically removes all created data
  });

  test('my test', async ({ page }) => {
    const user = await testDataFactory.createTestUser();
    const tenant = await testDataFactory.createTestTenant();
    // ... test logic
  });
});
```

### 3. Page Object Model

All UI interactions are encapsulated in Page Objects:

```typescript
// Good
const loginPage = new LoginPage(page);
await loginPage.goto();
await loginPage.loginWithDemoCode('TEST-CODE');

// Bad - Don't interact with page directly in tests
await page.goto('/');
await page.fill('input', 'TEST-CODE');
```

### 4. Test Isolation

Each test is completely independent:
- Creates its own test data
- Doesn't depend on other tests
- Cleans up after itself

## Test Coverage

### Authentication (`auth.spec.ts`)
- Demo code login flow
- Session management
- Role-based access control
- Login/logout functionality
- Invalid/expired code handling

### Application Workflow (`application-workflow.spec.ts`)
- Creating applications
- Submitting applications
- Draft management
- Application review process
- Comments and status changes
- Filtering and search

### Form Builder (`form-builder.spec.ts`)
- Creating form templates
- Adding/editing/deleting fields
- Form sections
- Field reordering (drag-and-drop)
- Conditional logic
- Publishing forms
- Permission checks

### Admin & Settings (`admin-settings.spec.ts`)
- User profile management
- Notification preferences
- Community settings
- User management
- Role assignment
- Workflow configuration

### Directory & Properties (`directory-properties.spec.ts`)
- User directory
- Search and filtering
- Property management
- Property details
- Owner information
- Application history per property

## Writing New Tests

### 1. Create Test File

```typescript
import { test, expect } from '@playwright/test';
import { TestDataFactory } from '../utils/test-data';

test.describe('My Feature', () => {
  let testDataFactory: TestDataFactory;

  test.beforeEach(async () => {
    testDataFactory = new TestDataFactory();
  });

  test.afterEach(async () => {
    await testDataFactory.cleanup();
  });

  test('should do something', async ({ page }) => {
    // Create test data
    const user = await testDataFactory.createTestUser();

    // Perform actions
    await page.goto('/my-feature');

    // Assert expected outcomes
    await expect(page.getByText('Expected Result')).toBeVisible();
  });
});
```

### 2. Create Page Object (if needed)

```typescript
import { Page, Locator, expect } from '@playwright/test';

export class MyFeaturePage {
  readonly page: Page;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.submitButton = page.getByRole('button', { name: /submit/i });
  }

  async goto() {
    await this.page.goto('/my-feature');
  }

  async submit() {
    await this.submitButton.click();
    await this.page.waitForLoadState('networkidle');
  }
}
```

## Best Practices

✅ **DO:**
- Use negative IDs for all test data
- Use TestDataFactory for data creation
- Clean up test data in `afterEach`
- Use Page Objects for UI interactions
- Make tests independent
- Use explicit waits with timeouts
- Test both success and error cases
- Use descriptive test names

❌ **DON'T:**
- Use positive IDs or real data
- Create data without cleaning it up
- Make tests depend on each other
- Use `waitForTimeout` (use explicit waits)
- Hardcode credentials or sensitive data
- Skip testing error scenarios

## Debugging Tests

### Debug Mode

```bash
npm run test:e2e:debug
```

This will:
- Open Playwright Inspector
- Pause before each action
- Allow step-by-step execution

### Screenshots and Videos

Configured to capture on failure:
- Screenshots: `test-results/`
- Videos: `test-results/`
- Traces: `test-results/`

### View Trace

```bash
npx playwright show-trace test-results/trace.zip
```

## CI/CD

Tests are configured to run in CI with:
- 2 retries on failure
- Sequential execution (workers: 1)
- HTML and JUnit reports generated
- Screenshots and videos on failure

## Maintenance

### Database Cleanup

Test data is automatically cleaned up after each test. For manual cleanup:

```typescript
import { cleanupAllTestData } from './e2e/utils/test-data';
await cleanupAllTestData();
```

### Updating Tests

When the application changes:
1. Update page objects first
2. Update fixtures if authentication changes
3. Update test assertions
4. Add new tests for new features

## Troubleshooting

### Tests Timing Out

- Check `timeout` in `playwright.config.ts`
- Ensure dev server is running
- Check for infinite loops in application

### Tests Failing Intermittently

- Add more explicit waits
- Check for race conditions
- Verify test data cleanup

### Can't See Browser

- Run with `--headed` flag
- Run with `--debug` flag
- Check `playwright.config.ts` `headless` setting

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Testing Best Practices](./.claude/testing-best-practices.md)
- [Page Object Model Guide](https://playwright.dev/docs/pom)
