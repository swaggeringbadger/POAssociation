/**
 * Test Helper Functions
 *
 * Common utility functions used across multiple tests
 */

/**
 * Generate a random string for test data
 */
export function randomString(length: number = 8): string {
  return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
}

/**
 * Generate a unique email for testing
 */
export function generateTestEmail(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${randomString(6)}@example.com`;
}

/**
 * Generate a unique subdomain for testing
 */
export function generateTestSubdomain(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${randomString(6)}`.toLowerCase();
}

/**
 * Wait for a specific amount of time (use sparingly - prefer explicit waits)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format a date for form input
 */
export function formatDateForInput(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get a date N days from now
 */
export function getFutureDate(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Get a date N days ago
 */
export function getPastDate(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Retry an async function until it succeeds or max attempts reached
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, onRetry } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      if (onRetry) {
        onRetry(attempt, error as Error);
      }

      await sleep(delay);
    }
  }

  throw new Error('Retry failed - should not reach here');
}

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
  return !!process.env.CI;
}

/**
 * Get base URL for tests
 */
export function getBaseURL(): string {
  return process.env.BASE_URL || 'http://localhost:5000';
}

/**
 * Generate a test phone number
 */
export function generateTestPhoneNumber(): string {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const prefix = Math.floor(Math.random() * 900) + 100;
  const lineNumber = Math.floor(Math.random() * 9000) + 1000;
  return `${areaCode}-${prefix}-${lineNumber}`;
}

/**
 * Create a test file buffer for upload testing
 */
export function createTestFile(
  filename: string,
  content: string = 'Test file content',
  mimeType: string = 'text/plain'
): Buffer {
  return Buffer.from(content);
}

/**
 * Sanitize a string to be used as a file name or ID
 */
export function sanitizeForId(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

/**
 * Generate test password (for any future password-based auth)
 */
export function generateTestPassword(): string {
  return `Test${randomString(8)}!123`;
}

/**
 * Parse error message from API response
 */
export function parseErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error) return error.error;
  return 'Unknown error';
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Deep clone an object (for test data manipulation)
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Compare two objects for deep equality
 */
export function deepEqual(obj1: any, obj2: any): boolean {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}

/**
 * Generate a random integer between min and max (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pick random element from array
 */
export function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Shuffle array randomly
 */
export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
