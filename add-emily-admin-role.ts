import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { eq, and } from "drizzle-orm";
import * as schema from "./shared/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle({ client: pool, schema });

async function addEmilyAdminRole() {
  try {
    // Find Emily (demo manager user)
    const emily = await db.select()
      .from(schema.users)
      .where(eq(schema.users.firstName, 'Emily'))
      .limit(1);

    if (!emily || emily.length === 0) {
      console.log('❌ Emily not found in database');
      return;
    }

    console.log(`✅ Found Emily: ${emily[0].email}`);

    // Find the management company she belongs to
    const emilyRoles = await db.select()
      .from(schema.userTenantRoles)
      .where(eq(schema.userTenantRoles.userId, emily[0].id));

    if (emilyRoles.length === 0) {
      console.log('❌ Emily has no tenant assignments');
      return;
    }

    // Get the management company (type = 'management_company')
    const managementCompanyRole = emilyRoles.find(async (role) => {
      const tenant = await db.select()
        .from(schema.tenants)
        .where(eq(schema.tenants.id, role.tenantId))
        .limit(1);
      return tenant[0]?.type === 'management_company';
    });

    // Find the management company tenant
    let managementCompanyId: string | null = null;
    for (const role of emilyRoles) {
      const tenant = await db.select()
        .from(schema.tenants)
        .where(eq(schema.tenants.id, role.tenantId))
        .limit(1);

      if (tenant[0]?.type === 'management_company') {
        managementCompanyId = tenant[0].id;
        break;
      }
    }

    if (!managementCompanyId) {
      console.log('❌ No management company found for Emily');
      return;
    }

    // Check if account_admin role already exists
    const existingAdminRole = await db.select()
      .from(schema.userTenantRoles)
      .where(
        and(
          eq(schema.userTenantRoles.userId, emily[0].id),
          eq(schema.userTenantRoles.tenantId, managementCompanyId),
          eq(schema.userTenantRoles.role, 'account_admin')
        )
      );

    if (existingAdminRole.length > 0) {
      console.log('✅ Emily already has account_admin role');
      return;
    }

    // Add account_admin role
    const newRole = await db.insert(schema.userTenantRoles)
      .values({
        userId: emily[0].id,
        tenantId: managementCompanyId,
        role: 'account_admin',
        demoCodeId: emily[0].demoCodeId,
      })
      .returning();

    console.log('✅ Successfully added account_admin role to Emily');
    console.log(`   User: ${emily[0].email}`);
    console.log(`   Tenant: ${managementCompanyId}`);
    console.log(`   Role: account_admin`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

addEmilyAdminRole();
