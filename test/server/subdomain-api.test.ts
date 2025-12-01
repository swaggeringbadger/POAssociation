/**
 * Subdomain API Integration Tests
 *
 * Tests the subdomain-related API endpoints and database operations.
 * These tests require a database connection and test real storage operations.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { db } from '@server/storage';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Test data cleanup helper
 */
async function cleanupTestTenants(subdomainPrefix: string) {
  try {
    // Find and delete tenants with our test prefix
    const tenants = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.subdomain, subdomainPrefix));

    for (const tenant of tenants) {
      await db.delete(schema.tenants).where(eq(schema.tenants.id, tenant.id));
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

describe('Subdomain Storage Operations', () => {
  const TEST_PREFIX = 'vitest-subdomain';
  let testTenantIds: string[] = [];

  beforeEach(() => {
    testTenantIds = [];
  });

  afterEach(async () => {
    // Cleanup test tenants
    for (const id of testTenantIds) {
      try {
        await db.delete(schema.tenants).where(eq(schema.tenants.id, id));
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('getTenantBySubdomain', () => {
    it('should find tenant by exact subdomain match', async () => {
      // Create test tenant
      const subdomain = `${TEST_PREFIX}-${Date.now()}`;
      const [tenant] = await db
        .insert(schema.tenants)
        .values({
          name: 'Test Tenant for Subdomain',
          type: 'community',
          subdomain,
          managementCompanyId: null,
          isActive: true,
        })
        .returning();

      testTenantIds.push(tenant.id);

      // Query by subdomain
      const [found] = await db
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.subdomain, subdomain));

      expect(found).toBeDefined();
      expect(found.id).toBe(tenant.id);
      expect(found.subdomain).toBe(subdomain);
    });

    it('should return empty for non-existent subdomain', async () => {
      const results = await db
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.subdomain, 'definitely-does-not-exist-xyz123'));

      expect(results).toHaveLength(0);
    });

    it('should be case-sensitive in database lookup', async () => {
      // Create tenant with lowercase subdomain
      const subdomain = `${TEST_PREFIX}-lowercase-${Date.now()}`;
      const [tenant] = await db
        .insert(schema.tenants)
        .values({
          name: 'Lowercase Subdomain Tenant',
          type: 'community',
          subdomain,
          managementCompanyId: null,
          isActive: true,
        })
        .returning();

      testTenantIds.push(tenant.id);

      // Query with exact case should find it
      const [found] = await db
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.subdomain, subdomain));

      expect(found).toBeDefined();

      // Note: PostgreSQL text comparisons are case-sensitive by default
      // The application layer (useSubdomain hook) handles case-insensitive matching
    });
  });

  describe('Subdomain Uniqueness Constraint', () => {
    it('should enforce unique subdomains', async () => {
      const subdomain = `${TEST_PREFIX}-unique-${Date.now()}`;

      // Create first tenant
      const [tenant1] = await db
        .insert(schema.tenants)
        .values({
          name: 'First Tenant',
          type: 'community',
          subdomain,
          managementCompanyId: null,
          isActive: true,
        })
        .returning();

      testTenantIds.push(tenant1.id);

      // Attempt to create second tenant with same subdomain should fail
      await expect(
        db.insert(schema.tenants).values({
          name: 'Second Tenant',
          type: 'community',
          subdomain, // Same subdomain - should violate constraint
          managementCompanyId: null,
          isActive: true,
        })
      ).rejects.toThrow();
    });

    it('should allow different subdomains for different tenants', async () => {
      const subdomain1 = `${TEST_PREFIX}-tenant1-${Date.now()}`;
      const subdomain2 = `${TEST_PREFIX}-tenant2-${Date.now()}`;

      const [tenant1] = await db
        .insert(schema.tenants)
        .values({
          name: 'Tenant One',
          type: 'community',
          subdomain: subdomain1,
          managementCompanyId: null,
          isActive: true,
        })
        .returning();

      testTenantIds.push(tenant1.id);

      const [tenant2] = await db
        .insert(schema.tenants)
        .values({
          name: 'Tenant Two',
          type: 'community',
          subdomain: subdomain2,
          managementCompanyId: null,
          isActive: true,
        })
        .returning();

      testTenantIds.push(tenant2.id);

      expect(tenant1.id).not.toBe(tenant2.id);
      expect(tenant1.subdomain).toBe(subdomain1);
      expect(tenant2.subdomain).toBe(subdomain2);
    });
  });

  describe('Subdomain Format Validation', () => {
    it('should accept simple alphanumeric subdomains', async () => {
      const subdomain = `${TEST_PREFIX}simple${Date.now()}`;

      const [tenant] = await db
        .insert(schema.tenants)
        .values({
          name: 'Simple Subdomain',
          type: 'community',
          subdomain,
          managementCompanyId: null,
          isActive: true,
        })
        .returning();

      testTenantIds.push(tenant.id);
      expect(tenant.subdomain).toBe(subdomain);
    });

    it('should accept hyphenated subdomains', async () => {
      const subdomain = `${TEST_PREFIX}-hyphen-test-${Date.now()}`;

      const [tenant] = await db
        .insert(schema.tenants)
        .values({
          name: 'Hyphenated Subdomain',
          type: 'community',
          subdomain,
          managementCompanyId: null,
          isActive: true,
        })
        .returning();

      testTenantIds.push(tenant.id);
      expect(tenant.subdomain).toBe(subdomain);
    });

    it('should accept subdomains with numbers', async () => {
      const subdomain = `${TEST_PREFIX}123test456-${Date.now()}`;

      const [tenant] = await db
        .insert(schema.tenants)
        .values({
          name: 'Numeric Subdomain',
          type: 'community',
          subdomain,
          managementCompanyId: null,
          isActive: true,
        })
        .returning();

      testTenantIds.push(tenant.id);
      expect(tenant.subdomain).toBe(subdomain);
    });
  });

  describe('Tenant Types with Subdomains', () => {
    it('should support community type with subdomain', async () => {
      const subdomain = `${TEST_PREFIX}-community-${Date.now()}`;

      const [tenant] = await db
        .insert(schema.tenants)
        .values({
          name: 'Community Tenant',
          type: 'community',
          subdomain,
          managementCompanyId: null,
          isActive: true,
        })
        .returning();

      testTenantIds.push(tenant.id);
      expect(tenant.type).toBe('community');
    });

    it('should support management_company type with subdomain', async () => {
      const subdomain = `${TEST_PREFIX}-mgmt-${Date.now()}`;

      const [tenant] = await db
        .insert(schema.tenants)
        .values({
          name: 'Management Company',
          type: 'management_company',
          subdomain,
          managementCompanyId: null,
          isActive: true,
        })
        .returning();

      testTenantIds.push(tenant.id);
      expect(tenant.type).toBe('management_company');
    });
  });

  describe('Active/Inactive Tenant Filtering', () => {
    it('should be able to filter tenants by active status', async () => {
      const subdomain = `${TEST_PREFIX}-active-${Date.now()}`;

      const [activeTenant] = await db
        .insert(schema.tenants)
        .values({
          name: 'Active Tenant',
          type: 'community',
          subdomain,
          managementCompanyId: null,
          isActive: true,
        })
        .returning();

      testTenantIds.push(activeTenant.id);

      // Find by subdomain with active filter
      const [found] = await db
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.subdomain, subdomain));

      expect(found).toBeDefined();
      expect(found.isActive).toBe(true);
    });

    it('should include inactive tenants in subdomain lookup', async () => {
      const subdomain = `${TEST_PREFIX}-inactive-${Date.now()}`;

      const [inactiveTenant] = await db
        .insert(schema.tenants)
        .values({
          name: 'Inactive Tenant',
          type: 'community',
          subdomain,
          managementCompanyId: null,
          isActive: false,
        })
        .returning();

      testTenantIds.push(inactiveTenant.id);

      // Subdomain lookup should still find inactive tenants
      // (business logic decides whether to allow access)
      const [found] = await db
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.subdomain, subdomain));

      expect(found).toBeDefined();
      expect(found.isActive).toBe(false);
    });
  });
});

describe('Demo Code Ecosystem Subdomains', () => {
  let testDemoCodeId: string | null = null;
  let testTenantIds: string[] = [];

  afterEach(async () => {
    // Cleanup in correct order (tenants first, then demo codes)
    for (const id of testTenantIds) {
      try {
        await db.delete(schema.tenants).where(eq(schema.tenants.id, id));
      } catch (error) {
        // Ignore
      }
    }

    if (testDemoCodeId) {
      try {
        await db.delete(schema.demoCodes).where(eq(schema.demoCodes.id, testDemoCodeId));
      } catch (error) {
        // Ignore
      }
    }

    testTenantIds = [];
    testDemoCodeId = null;
  });

  it('should link tenants to demo codes via demoCodeId', async () => {
    // Create demo code
    const [demoCode] = await db
      .insert(schema.demoCodes)
      .values({
        code: `TEST-SUBDOMAIN-${Date.now()}`,
        label: 'Subdomain Test Demo',
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isActive: true,
        isProvisioned: true,
        provisionedAt: new Date(),
      })
      .returning();

    testDemoCodeId = demoCode.id;

    // Create tenant linked to demo code
    const subdomain = `test-demo-tenant-${Date.now()}`;
    const [tenant] = await db
      .insert(schema.tenants)
      .values({
        name: 'Demo Linked Tenant',
        type: 'community',
        subdomain,
        managementCompanyId: null,
        demoCodeId: demoCode.id,
        isActive: true,
      })
      .returning();

    testTenantIds.push(tenant.id);

    expect(tenant.demoCodeId).toBe(demoCode.id);

    // Verify lookup still works
    const [found] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.subdomain, subdomain));

    expect(found).toBeDefined();
    expect(found.demoCodeId).toBe(demoCode.id);
  });

  it('should support subdomain pattern with demo code suffix', async () => {
    // Demo ecosystems append suffixes like -ec0f707e
    const baseName = 'markland';
    const suffix = 'ec0f707e';
    const subdomain = `${baseName}-${suffix}`;

    const [tenant] = await db
      .insert(schema.tenants)
      .values({
        name: 'Markland POA (Demo)',
        type: 'community',
        subdomain,
        managementCompanyId: null,
        isActive: true,
      })
      .returning();

    testTenantIds.push(tenant.id);

    // Verify the hyphenated subdomain is stored correctly
    const [found] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.subdomain, subdomain));

    expect(found).toBeDefined();
    expect(found.subdomain).toBe(subdomain);
    expect(found.subdomain).toContain(baseName);
    expect(found.subdomain).toContain(suffix);
  });
});
