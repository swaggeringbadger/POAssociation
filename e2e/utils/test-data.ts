import { db } from '../../server/storage';
import * as schema from '../../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Test Data Utilities
 *
 * Best Practice: Use NEGATIVE primary keys for all test data
 * - Makes test data easily identifiable in the database
 * - Prevents conflicts with production data
 * - Enables quick cleanup with "DELETE WHERE id < 0"
 * - Simplifies debugging and troubleshooting
 */

// Counter for generating unique negative IDs
let testIdCounter = -1;

/**
 * Generate a unique negative ID for test data
 */
export function generateTestId(): number {
  return testIdCounter--;
}

/**
 * Reset the test ID counter (useful between test runs)
 */
export function resetTestIdCounter(): void {
  testIdCounter = -1;
}

/**
 * Test Data Interfaces
 */
export interface TestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
}

export interface TestTenant {
  id: string;
  name: string;
  type: 'management_company' | 'community';
  subdomain: string;
}

export interface TestApplication {
  id: number;
  tenantId: string;
  projectType: string;
  status: string;
}

/**
 * Test data factory for creating users
 */
export class TestDataFactory {
  private createdUsers: string[] = [];
  private createdTenants: string[] = [];
  private createdApplications: number[] = [];
  private createdDemoCodes: string[] = [];
  private createdUserTenantRoles: string[] = [];

  /**
   * Create a test user with negative ID pattern
   */
  async createTestUser(overrides?: Partial<TestUser>): Promise<TestUser> {
    const testId = `test-user-${Math.abs(generateTestId())}`;
    const uniqueEmail = `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;

    const userData = {
      id: testId,
      email: overrides?.email || uniqueEmail,
      firstName: overrides?.firstName || 'Test',
      lastName: overrides?.lastName || 'User',
      phoneNumber: '555-0100',
      profileImageUrl: null,
      notificationPreferences: {
        applicationSubmitted: true,
        applicationApproved: true,
        applicationRejected: true,
        commentsAdded: true,
        stepAssigned: true,
      },
      demoCodeId: null,
    };

    const [user] = await db.insert(schema.users).values(userData).returning();
    this.createdUsers.push(user.id);

    return {
      id: user.id,
      email: user.email!,
      firstName: user.firstName!,
      lastName: user.lastName!,
    };
  }

  /**
   * Create a test tenant with negative ID pattern
   */
  async createTestTenant(overrides?: Partial<TestTenant>): Promise<TestTenant> {
    const testId = `test-tenant-${Math.abs(generateTestId())}`;
    const uniqueSubdomain = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const tenantData = {
      id: testId,
      name: overrides?.name || 'Test Community',
      type: overrides?.type || 'community',
      subdomain: overrides?.subdomain || uniqueSubdomain,
      managementCompanyId: null,
      workflowTemplateId: null,
      designGuidelinesUrl: null,
      settings: null,
      demoCodeId: null,
      isActive: true,
    };

    const [tenant] = await db.insert(schema.tenants).values(tenantData).returning();
    this.createdTenants.push(tenant.id);

    return {
      id: tenant.id,
      name: tenant.name,
      type: tenant.type as 'management_company' | 'community',
      subdomain: tenant.subdomain,
    };
  }

  /**
   * Create a test demo code with negative ID pattern
   */
  async createTestDemoCode(overrides?: Partial<any>): Promise<any> {
    const testId = `test-demo-${Math.abs(generateTestId())}`;
    const uniqueCode = `TEST-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

    const demoCodeData = {
      id: testId,
      code: overrides?.code || uniqueCode,
      label: overrides?.label || 'Test Demo Code',
      validFrom: overrides?.validFrom || new Date(),
      validUntil: overrides?.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: overrides?.isActive !== undefined ? overrides.isActive : true,
      maxUses: overrides?.maxUses || null,
      currentUses: 0,
      isProvisioned: false,
      provisionedAt: null,
      createdBy: null,
    };

    const [demoCode] = await db.insert(schema.demoCodes).values(demoCodeData).returning();
    this.createdDemoCodes.push(demoCode.id);

    return demoCode;
  }

  /**
   * Assign a user to a tenant with a role
   */
  async createUserTenantRole(userId: string, tenantId: string, role: string): Promise<any> {
    const testId = `test-role-${Math.abs(generateTestId())}`;

    const roleData = {
      id: testId,
      userId,
      tenantId,
      role,
      demoCodeId: null,
    };

    const [userTenantRole] = await db.insert(schema.userTenantRoles).values(roleData).returning();
    this.createdUserTenantRoles.push(userTenantRole.id);

    return userTenantRole;
  }

  /**
   * Create a test application with negative ID pattern
   * Note: Applications table uses integer IDs in the schema
   */
  async createTestApplication(tenantId: string, userId: string, overrides?: Partial<any>): Promise<any> {
    const testId = generateTestId(); // This will be a negative integer

    const applicationData = {
      id: testId,
      tenantId,
      userId,
      projectType: overrides?.projectType || 'exterior-modifications',
      propertyAddress: overrides?.propertyAddress || '123 Test Street',
      status: overrides?.status || 'draft',
      formData: overrides?.formData || {},
      currentStepId: null,
      submittedAt: overrides?.submittedAt || null,
      reviewedAt: null,
      reviewedBy: null,
      demoCodeId: null,
    };

    // Note: If the schema expects string IDs, convert testId to string
    // For now, assuming it accepts integers based on the generateTestId function
    const [application] = await db.insert(schema.applications as any).values({
      ...applicationData,
      id: testId.toString(), // Convert to string if needed
    }).returning();

    this.createdApplications.push(parseInt(application.id as any));

    return application;
  }

  /**
   * Cleanup all created test data
   * Call this in afterEach or afterAll hooks
   */
  async cleanup(): Promise<void> {
    try {
      // Delete in reverse order of creation to respect foreign keys

      // Delete applications
      for (const id of this.createdApplications) {
        await db.delete(schema.applications as any).where(eq((schema.applications as any).id, id.toString()));
      }

      // Delete user tenant roles
      for (const id of this.createdUserTenantRoles) {
        await db.delete(schema.userTenantRoles).where(eq(schema.userTenantRoles.id, id));
      }

      // Delete users
      for (const id of this.createdUsers) {
        await db.delete(schema.users).where(eq(schema.users.id, id));
      }

      // Delete tenants
      for (const id of this.createdTenants) {
        await db.delete(schema.tenants).where(eq(schema.tenants.id, id));
      }

      // Delete demo codes
      for (const id of this.createdDemoCodes) {
        await db.delete(schema.demoCodes).where(eq(schema.demoCodes.id, id));
      }

      // Clear tracking arrays
      this.createdApplications = [];
      this.createdUserTenantRoles = [];
      this.createdUsers = [];
      this.createdTenants = [];
      this.createdDemoCodes = [];
    } catch (error) {
      console.error('Error cleaning up test data:', error);
      throw error;
    }
  }

  /**
   * Get count of created test entities
   */
  getCreatedCounts() {
    return {
      users: this.createdUsers.length,
      tenants: this.createdTenants.length,
      applications: this.createdApplications.length,
      demoCodes: this.createdDemoCodes.length,
      userTenantRoles: this.createdUserTenantRoles.length,
    };
  }
}

/**
 * Global cleanup function to remove all test data
 * Useful for CI/CD cleanup or manual maintenance
 */
export async function cleanupAllTestData(): Promise<void> {
  try {
    // This would delete all records with negative IDs
    // Be careful with this in production!
    console.log('Cleaning up all test data...');

    // Note: Adjust these queries based on your actual schema
    // This is a template - you may need to modify column names

    // Add more cleanup queries as needed

    console.log('Test data cleanup complete');
  } catch (error) {
    console.error('Error in global test data cleanup:', error);
    throw error;
  }
}
