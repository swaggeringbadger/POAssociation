/**
 * Test Utilities and Helpers
 *
 * Best Practice: Use negative IDs for test data
 * This makes test data easily identifiable and cleanable
 */

let testIdCounter = -1;

/**
 * Generate unique negative test ID
 */
export function generateTestId(): number {
  return testIdCounter--;
}

/**
 * Reset test ID counter (call in beforeEach)
 */
export function resetTestIdCounter(): void {
  testIdCounter = -1;
}

/**
 * Create test user data with negative ID
 */
export function createTestUser(overrides: Partial<any> = {}) {
  const id = generateTestId();
  return {
    id: `test-user-${Math.abs(id)}`,
    email: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    phoneNumber: '555-0100',
    ...overrides,
  };
}

/**
 * Create test tenant data with negative ID
 */
export function createTestTenant(overrides: Partial<any> = {}) {
  const id = generateTestId();
  return {
    id: `test-tenant-${Math.abs(id)}`,
    name: 'Test Community',
    type: 'community',
    subdomain: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    isActive: true,
    ...overrides,
  };
}

/**
 * Create test application data with negative ID
 */
export function createTestApplication(overrides: Partial<any> = {}) {
  const id = generateTestId();
  return {
    id,
    tenantId: `test-tenant-1`,
    userId: `test-user-1`,
    projectType: 'exterior-modifications',
    propertyAddress: '123 Test Street',
    status: 'draft',
    formData: {},
    ...overrides,
  };
}

/**
 * Create test demo code data with negative ID
 */
export function createTestDemoCode(overrides: Partial<any> = {}) {
  const id = generateTestId();
  return {
    id: `test-demo-${Math.abs(id)}`,
    code: `TEST-${Date.now().toString().slice(-6)}`,
    label: 'Test Demo Code',
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    isActive: true,
    currentUses: 0,
    ...overrides,
  };
}

/**
 * Wait for async operations
 */
export function wait(ms: number = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock fetch response
 */
export function mockFetchResponse(data: any, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response);
}

/**
 * Mock fetch error
 */
export function mockFetchError(message: string) {
  return Promise.reject(new Error(message));
}
