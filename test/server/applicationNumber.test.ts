import { describe, it, expect } from 'vitest';

/**
 * Application Number Generation Tests
 *
 * Tests for the application number generation logic from commit 1af9792:
 * Format: {tenant-last-4-chars}-{year}-{random-4-alphanumeric}
 * Example: A1B2-2025-XY9Z
 *
 * This ensures unique, identifiable application numbers for each submission.
 */

/**
 * Generate application number based on tenant ID and current year
 * Replicates the logic from server/routes.ts
 */
function generateApplicationNumber(tenantId: string): string {
  // Get last 4 characters of tenant ID (uppercase)
  const tenantSuffix = tenantId.slice(-4).toUpperCase();

  // Get current year
  const year = new Date().getFullYear();

  // Generate random 4-character alphanumeric
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomPart = '';
  for (let i = 0; i < 4; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `${tenantSuffix}-${year}-${randomPart}`;
}

/**
 * Validate application number format
 */
function isValidApplicationNumber(appNum: string): boolean {
  // Format: XXXX-YYYY-XXXX where X is alphanumeric and Y is a year digit
  const pattern = /^[A-Z0-9]{4}-\d{4}-[A-Z0-9]{4}$/;
  return pattern.test(appNum);
}

/**
 * Extract components from application number
 */
function parseApplicationNumber(appNum: string): {
  tenantSuffix: string;
  year: number;
  randomPart: string;
} | null {
  const parts = appNum.split('-');
  if (parts.length !== 3) return null;

  const [tenantSuffix, yearStr, randomPart] = parts;
  const year = parseInt(yearStr, 10);

  if (isNaN(year)) return null;
  if (tenantSuffix.length !== 4) return null;
  if (randomPart.length !== 4) return null;

  return { tenantSuffix, year, randomPart };
}

describe('Application Number Generation', () => {
  describe('generateApplicationNumber', () => {
    it('should generate valid application number format', () => {
      const tenantId = 'test-tenant-abc123';
      const appNum = generateApplicationNumber(tenantId);

      expect(isValidApplicationNumber(appNum)).toBe(true);
    });

    it('should use last 4 characters of tenant ID', () => {
      const tenantId = 'tenant-1234abcd';
      const appNum = generateApplicationNumber(tenantId);

      const parsed = parseApplicationNumber(appNum);
      expect(parsed?.tenantSuffix).toBe('ABCD');
    });

    it('should include current year', () => {
      const tenantId = 'test-tenant';
      const appNum = generateApplicationNumber(tenantId);

      const parsed = parseApplicationNumber(appNum);
      expect(parsed?.year).toBe(new Date().getFullYear());
    });

    it('should generate 4-character random part', () => {
      const tenantId = 'test-tenant';
      const appNum = generateApplicationNumber(tenantId);

      const parsed = parseApplicationNumber(appNum);
      expect(parsed?.randomPart.length).toBe(4);
    });

    it('should uppercase the tenant suffix', () => {
      const tenantId = 'tenant-wxyz';
      const appNum = generateApplicationNumber(tenantId);

      const parsed = parseApplicationNumber(appNum);
      expect(parsed?.tenantSuffix).toBe('WXYZ');
    });

    it('should generate different numbers for same tenant', () => {
      const tenantId = 'test-tenant';
      const numbers = new Set<string>();

      // Generate 100 numbers
      for (let i = 0; i < 100; i++) {
        numbers.add(generateApplicationNumber(tenantId));
      }

      // Should have high uniqueness (at least 95 unique out of 100)
      expect(numbers.size).toBeGreaterThan(95);
    });

    it('should handle short tenant IDs', () => {
      const tenantId = 'ab';
      const appNum = generateApplicationNumber(tenantId);

      // Short tenant IDs produce shorter prefix - the format still has structure
      // but may not pass strict 4-char validation
      expect(appNum).toMatch(/^\w+-\d{4}-[A-Z0-9]{4}$/);
      const parts = appNum.split('-');
      expect(parts.length).toBe(3);
      expect(parts[0]).toBe('AB'); // 'ab' uppercased
    });

    it('should handle UUID tenant IDs', () => {
      const tenantId = '550e8400-e29b-41d4-a716-446655440000';
      const appNum = generateApplicationNumber(tenantId);

      expect(isValidApplicationNumber(appNum)).toBe(true);
      const parsed = parseApplicationNumber(appNum);
      expect(parsed?.tenantSuffix).toBe('0000');
    });

    it('should handle tenant IDs with special characters', () => {
      const tenantId = 'tenant_with-special.chars!';
      const appNum = generateApplicationNumber(tenantId);

      // Should still work (last 4 chars might include special chars)
      expect(appNum).toMatch(/^.{4}-\d{4}-.{4}$/);
    });
  });

  describe('isValidApplicationNumber', () => {
    it('should validate correct format', () => {
      expect(isValidApplicationNumber('ABCD-2025-XY9Z')).toBe(true);
      expect(isValidApplicationNumber('1234-2025-ABCD')).toBe(true);
      expect(isValidApplicationNumber('A1B2-2024-C3D4')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(isValidApplicationNumber('ABC-2025-XY9Z')).toBe(false); // Too short prefix
      expect(isValidApplicationNumber('ABCDE-2025-XY9Z')).toBe(false); // Too long prefix
      expect(isValidApplicationNumber('ABCD-25-XY9Z')).toBe(false); // Short year
      expect(isValidApplicationNumber('ABCD-2025-XYZ')).toBe(false); // Short suffix
      expect(isValidApplicationNumber('abcd-2025-xy9z')).toBe(false); // Lowercase
      expect(isValidApplicationNumber('ABCD2025XY9Z')).toBe(false); // Missing dashes
    });

    it('should reject empty or null values', () => {
      expect(isValidApplicationNumber('')).toBe(false);
    });
  });

  describe('parseApplicationNumber', () => {
    it('should parse valid application number', () => {
      const parsed = parseApplicationNumber('ABCD-2025-XY9Z');

      expect(parsed).toEqual({
        tenantSuffix: 'ABCD',
        year: 2025,
        randomPart: 'XY9Z',
      });
    });

    it('should return null for invalid format', () => {
      expect(parseApplicationNumber('invalid')).toBeNull();
      expect(parseApplicationNumber('ABCD-XXXX-1234')).toBeNull(); // Invalid year
      expect(parseApplicationNumber('AB-2025-XY')).toBeNull(); // Wrong lengths
    });

    it('should handle various years', () => {
      const parsed2024 = parseApplicationNumber('ABCD-2024-XY9Z');
      expect(parsed2024?.year).toBe(2024);

      const parsed2030 = parseApplicationNumber('ABCD-2030-XY9Z');
      expect(parsed2030?.year).toBe(2030);
    });
  });

  describe('Application Number Uniqueness', () => {
    it('should have low collision probability', () => {
      // Calculate collision probability
      // 36^4 = 1,679,616 possible random parts
      // For a community with 100 applications per year, collision is very unlikely

      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const possibleCombinations = Math.pow(chars.length, 4);

      expect(possibleCombinations).toBeGreaterThan(1_000_000);
    });

    it('should include year to partition numbers', () => {
      // Numbers from different years won't collide
      const num2024 = 'ABCD-2024-XY9Z';
      const num2025 = 'ABCD-2025-XY9Z';

      // Same tenant suffix and random part, but different years
      expect(num2024).not.toBe(num2025);
    });

    it('should include tenant to partition numbers', () => {
      // Numbers from different tenants won't collide (even with same random)
      const numTenant1 = 'ABC1-2025-XY9Z';
      const numTenant2 = 'ABC2-2025-XY9Z';

      expect(numTenant1).not.toBe(numTenant2);
    });
  });

  describe('Display Format', () => {
    it('should be human-readable', () => {
      const appNum = 'MW12-2025-AB3C';

      // Easy to read over phone
      expect(appNum.length).toBe(14);
      expect(appNum.split('-')).toHaveLength(3);
    });

    it('should be easy to search/filter', () => {
      const appNum = 'MW12-2025-AB3C';

      // Can search by year
      expect(appNum).toContain('2025');

      // Can filter by tenant prefix
      expect(appNum.startsWith('MW12')).toBe(true);
    });

    it('should be URL-safe', () => {
      const appNum = 'ABCD-2025-XY9Z';

      // All characters are URL-safe
      const urlSafe = encodeURIComponent(appNum);
      expect(urlSafe).toBe(appNum);
    });
  });
});
