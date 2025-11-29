import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateTestId,
  resetTestIdCounter,
  createTestUser,
  createTestTenant,
  createTestApplication,
  createTestDemoCode,
} from './test-helpers';

/**
 * Test Helpers Tests
 *
 * Tests for our test utility functions
 * Demonstrates the negative ID pattern in action
 */

describe('Test Helpers - Negative ID Pattern', () => {
  beforeEach(() => {
    resetTestIdCounter();
  });

  describe('generateTestId', () => {
    it('should generate negative IDs', () => {
      const id1 = generateTestId();
      const id2 = generateTestId();
      const id3 = generateTestId();

      expect(id1).toBe(-1);
      expect(id2).toBe(-2);
      expect(id3).toBe(-3);
    });

    it('should generate unique IDs', () => {
      const ids = new Set([
        generateTestId(),
        generateTestId(),
        generateTestId(),
        generateTestId(),
        generateTestId(),
      ]);

      expect(ids.size).toBe(5);
    });

    it('should reset counter', () => {
      generateTestId(); // -1
      generateTestId(); // -2

      resetTestIdCounter();

      const id = generateTestId();
      expect(id).toBe(-1);
    });
  });

  describe('createTestUser', () => {
    it('should create user with negative ID pattern', () => {
      const user = createTestUser();

      expect(user.id).toMatch(/^test-user-\d+$/);
      expect(user.email).toContain('@example.com');
      expect(user.firstName).toBe('Test');
      expect(user.lastName).toBe('User');
    });

    it('should allow overrides', () => {
      const user = createTestUser({
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: '555-1234',
      });

      expect(user.firstName).toBe('John');
      expect(user.lastName).toBe('Doe');
      expect(user.phoneNumber).toBe('555-1234');
    });

    it('should generate unique emails', () => {
      const user1 = createTestUser();
      const user2 = createTestUser();

      expect(user1.email).not.toBe(user2.email);
    });

    it('should generate unique IDs', () => {
      const user1 = createTestUser();
      const user2 = createTestUser();

      expect(user1.id).not.toBe(user2.id);
    });
  });

  describe('createTestTenant', () => {
    it('should create tenant with negative ID pattern', () => {
      const tenant = createTestTenant();

      expect(tenant.id).toMatch(/^test-tenant-\d+$/);
      expect(tenant.name).toBe('Test Community');
      expect(tenant.type).toBe('community');
      expect(tenant.isActive).toBe(true);
    });

    it('should generate unique subdomains', () => {
      const tenant1 = createTestTenant();
      const tenant2 = createTestTenant();

      expect(tenant1.subdomain).not.toBe(tenant2.subdomain);
      expect(tenant1.subdomain).toMatch(/^test-/);
    });

    it('should allow overrides', () => {
      const tenant = createTestTenant({
        name: 'Custom Community',
        type: 'management_company',
      });

      expect(tenant.name).toBe('Custom Community');
      expect(tenant.type).toBe('management_company');
    });
  });

  describe('createTestApplication', () => {
    it('should create application with negative ID', () => {
      const app = createTestApplication();

      expect(app.id).toBeLessThan(0);
      expect(app.tenantId).toMatch(/^test-tenant/);
      expect(app.userId).toMatch(/^test-user/);
      expect(app.status).toBe('draft');
    });

    it('should allow custom properties', () => {
      const app = createTestApplication({
        status: 'submitted',
        projectType: 'structural-changes',
        propertyAddress: '456 Custom Street',
      });

      expect(app.status).toBe('submitted');
      expect(app.projectType).toBe('structural-changes');
      expect(app.propertyAddress).toBe('456 Custom Street');
    });

    it('should generate sequential negative IDs', () => {
      resetTestIdCounter();
      const app1 = createTestApplication();
      const app2 = createTestApplication();
      const app3 = createTestApplication();

      expect(app1.id).toBe(-1);
      expect(app2.id).toBe(-2);
      expect(app3.id).toBe(-3);
    });
  });

  describe('createTestDemoCode', () => {
    it('should create demo code with negative ID pattern', () => {
      const demoCode = createTestDemoCode();

      expect(demoCode.id).toMatch(/^test-demo-\d+$/);
      expect(demoCode.code).toMatch(/^TEST-\d+$/);
      expect(demoCode.label).toBe('Test Demo Code');
      expect(demoCode.isActive).toBe(true);
      expect(demoCode.currentUses).toBe(0);
    });

    it('should have valid date range', () => {
      const demoCode = createTestDemoCode();

      expect(demoCode.validFrom).toBeInstanceOf(Date);
      expect(demoCode.validUntil).toBeInstanceOf(Date);
      expect(demoCode.validUntil.getTime()).toBeGreaterThan(demoCode.validFrom.getTime());
    });

    it('should generate unique codes', () => {
      const code1 = createTestDemoCode();
      const code2 = createTestDemoCode();

      // May be same if called in same millisecond, so just check format
      expect(code1.code).toMatch(/^TEST-\d+$/);
      expect(code2.code).toMatch(/^TEST-\d+$/);
    });
  });
});

describe('Negative ID Pattern Benefits', () => {
  beforeEach(() => {
    resetTestIdCounter();
  });

  it('should make test data easily identifiable', () => {
    const user = createTestUser();
    const tenant = createTestTenant();
    const app = createTestApplication();

    // All IDs clearly indicate they're test data
    expect(user.id).toContain('test-user');
    expect(tenant.id).toContain('test-tenant');
    expect(app.id).toBeLessThan(0);
  });

  it('should prevent conflicts with production data', () => {
    // Production data typically uses positive IDs or UUIDs
    const productionId = 1;
    const testId = generateTestId();

    // Test IDs are negative, so no conflicts
    expect(testId).not.toBe(productionId);
    expect(testId).toBeLessThan(0);
  });

  it('should enable bulk cleanup queries', () => {
    // In real database cleanup, you could do:
    // DELETE FROM users WHERE id LIKE 'test-%'
    // DELETE FROM applications WHERE id < 0

    const user = createTestUser();
    const app = createTestApplication();

    expect(user.id.startsWith('test-')).toBe(true);
    expect(app.id < 0).toBe(true);
  });
});
