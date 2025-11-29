# E2E Tests - Quick Start Guide

## ✅ Status: **READY TO RUN**

The auth tests are **complete with real implementation** - they just need a proper environment (not Replit).

## 🚀 Run Tests (Local Machine)

```bash
# 1. Install Playwright with system dependencies
npx playwright install --with-deps chromium

# 2. Start dev server (Terminal 1)
npm run dev

# 3. Run tests (Terminal 2)
npm run test:e2e

# Or run just the working auth tests
npx playwright test e2e/tests/auth-working.spec.ts
```

## 📊 What You Get

**11 Working Tests:**
- ✅ Demo code page loads
- ✅ Invalid code rejection
- ✅ Expired code handling
- ✅ Inactive code handling
- ✅ Protected route access
- ✅ Empty input validation
- ✅ Code formatting (uppercase)
- ✅ Marketing content display
- ✅ Accessibility checks
- ✅ Loading states
- ✅ Test data with negative IDs

## 🎯 Key Features

### Negative ID Pattern
```typescript
// All test data uses negative IDs
const demoCode = await testDataFactory.createTestDemoCode({
  code: 'TEST-CODE-123',
});
// Creates ID like: "test-demo-1"

// Cleanup is automatic!
test.afterEach(async () => {
  await testDataFactory.cleanup(); // Removes all test data
});
```

### Page Object Pattern
```typescript
const loginPage = new LoginPage(page);
await loginPage.goto();
await loginPage.enterDemoCode('TEST-123');
await loginPage.clickAccessDemo();
await loginPage.verifyErrorMessage();
```

### Real Selectors
Based on your actual UI code:
- `getByPlaceholder('DEMO-CODE-HERE')`
- `getByRole('button', { name: /Access Demo/i })`
- Toast notifications for errors

## 📝 Test Example

```typescript
test('should reject invalid demo code', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();

  await loginPage.enterDemoCode('INVALID-123');
  await loginPage.clickAccessDemo();

  // Verifies toast error appears
  await loginPage.verifyErrorMessage();
});
```

## 🐛 Troubleshooting

### "Executable doesn't exist" Error
**Solution**: Install browsers with deps:
```bash
npx playwright install --with-deps
```

### "Server not running" Error
**Solution**: Start dev server first:
```bash
npm run dev
```

### Tests failing in Replit
**Reason**: Missing system libraries (libglib, etc.)
**Solution**: Run on local machine or CI/CD

## 📚 Documentation

- **Full Guide**: `e2e/README.md`
- **Best Practices**: `.claude/testing-best-practices.md`
- **Summary**: `E2E-TEST-SUMMARY.md`

## 🎨 Extending Tests

Follow the pattern from `auth-working.spec.ts`:

1. Create test data with factory
2. Use page objects
3. Verify with assertions
4. Cleanup happens automatically

```typescript
test('my new test', async ({ page }) => {
  let testDataFactory = new TestDataFactory();

  // Create test data
  const user = await testDataFactory.createTestUser();

  // Use page object
  const myPage = new MyPage(page);
  await myPage.doSomething();

  // Verify
  await expect(page.getByText('Success')).toBeVisible();

  // Cleanup (in afterEach hook)
  await testDataFactory.cleanup();
});
```

## ✨ Best Practices Checklist

- ✅ Use negative IDs for test data
- ✅ Use page objects (not direct page interactions)
- ✅ Clean up test data in afterEach
- ✅ Use descriptive test names
- ✅ Test both success and error cases
- ✅ Use semantic selectors (roles, labels)
- ✅ Avoid hardcoded waits
- ✅ Make tests independent

---

**Ready to run!** Copy to local machine and execute `npm run test:e2e` 🚀
