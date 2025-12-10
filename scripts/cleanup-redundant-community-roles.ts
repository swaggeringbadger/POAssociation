/**
 * Migration script to clean up redundant community-level role entries.
 *
 * Problem: Users with management_manager or account_admin at a management company
 * previously had redundant management_rep entries at each community they managed.
 * This caused role "downgrade" when switching to community context.
 *
 * Solution: Remove these redundant community-level role entries since management
 * company roles now automatically inherit to managed communities.
 *
 * Run with: npx tsx scripts/cleanup-redundant-community-roles.ts
 */

import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { eq, and, inArray } from "drizzle-orm";
import * as schema from "../shared/schema";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

async function cleanupRedundantRoles() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const db = drizzle({ client: pool, schema });

  console.log('Starting cleanup of redundant community-level roles...\n');

  // Step 1: Find all management companies
  const managementCompanies = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.type, 'management_company'));

  console.log(`Found ${managementCompanies.length} management companies\n`);

  let totalRemoved = 0;

  for (const mgmtCompany of managementCompanies) {
    console.log(`Processing: ${mgmtCompany.name} (${mgmtCompany.id})`);

    // Step 2: Find users who have management_manager or account_admin at this management company
    const privilegedRoles = await db
      .select()
      .from(schema.userTenantRoles)
      .where(
        and(
          eq(schema.userTenantRoles.tenantId, mgmtCompany.id),
          eq(schema.userTenantRoles.isActive, true),
          inArray(schema.userTenantRoles.role, ['management_manager', 'account_admin'])
        )
      );

    // Get unique user IDs with these privileged roles
    const privilegedUserIds = [...new Set(privilegedRoles.map(r => r.userId))];
    console.log(`  Found ${privilegedUserIds.length} users with management_manager or account_admin`);

    if (privilegedUserIds.length === 0) continue;

    // Step 3: Find all communities managed by this management company
    const managedCommunities = await db
      .select()
      .from(schema.tenants)
      .where(
        and(
          eq(schema.tenants.type, 'community'),
          eq(schema.tenants.managementCompanyId, mgmtCompany.id)
        )
      );

    const communityIds = managedCommunities.map(c => c.id);
    console.log(`  Found ${communityIds.length} managed communities`);

    if (communityIds.length === 0) continue;

    // Step 4: Find and remove redundant management_rep entries at community level
    // for users who have management_manager or account_admin at management company
    for (const userId of privilegedUserIds) {
      const redundantRoles = await db
        .select()
        .from(schema.userTenantRoles)
        .where(
          and(
            eq(schema.userTenantRoles.userId, userId),
            eq(schema.userTenantRoles.role, 'management_rep'),
            eq(schema.userTenantRoles.isActive, true),
            inArray(schema.userTenantRoles.tenantId, communityIds)
          )
        );

      if (redundantRoles.length > 0) {
        console.log(`    User ${userId}: Removing ${redundantRoles.length} redundant management_rep entries`);

        // Soft delete by setting isActive = false
        for (const role of redundantRoles) {
          await db
            .update(schema.userTenantRoles)
            .set({
              isActive: false,
              deactivatedAt: new Date(),
            })
            .where(eq(schema.userTenantRoles.id, role.id));
        }

        totalRemoved += redundantRoles.length;
      }
    }
  }

  console.log(`\n✅ Cleanup complete. Removed ${totalRemoved} redundant role entries.`);

  await pool.end();
}

cleanupRedundantRoles()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error during cleanup:', err);
    process.exit(1);
  });
