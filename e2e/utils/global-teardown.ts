import { FullConfig } from '@playwright/test';

/**
 * Global Teardown
 *
 * Runs once after all tests complete
 * - Clean up test data
 * - Close connections
 * - Generate final reports
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Running global test teardown...');

  // Optional: Clean up any remaining test data
  // This is a safety net - individual tests should clean up after themselves
  // await cleanupAllTestData();

  console.log('✅ Global teardown complete');
}

export default globalTeardown;
