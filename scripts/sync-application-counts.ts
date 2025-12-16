/**
 * One-time sync script to update tenant_subscriptions.usage_applications_current_month
 * based on actual application counts from the applications table.
 *
 * Run with: npx tsx scripts/sync-application-counts.ts
 */

import { db } from '../server/storage';
import { sql } from 'drizzle-orm';

async function syncApplicationCounts() {
  console.log('Starting application count sync...');

  // Get current month boundaries
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  console.log(`Counting applications from ${firstOfMonth.toISOString()} to ${firstOfNextMonth.toISOString()}`);

  // Get application counts per tenant for current month
  const counts = await db.execute(sql`
    SELECT
      tenant_id,
      COUNT(*)::int as app_count
    FROM applications
    WHERE submitted_at >= ${firstOfMonth}
      AND submitted_at < ${firstOfNextMonth}
    GROUP BY tenant_id
  `);

  console.log(`Found ${counts.rows.length} tenants with applications this month`);

  // Update each tenant's subscription
  let updated = 0;
  let created = 0;

  for (const row of counts.rows as { tenant_id: string; app_count: number }[]) {
    const { tenant_id, app_count } = row;

    // Try to update existing subscription
    const result = await db.execute(sql`
      UPDATE tenant_subscriptions
      SET usage_applications_current_month = ${app_count},
          updated_at = NOW()
      WHERE tenant_id = ${tenant_id}
    `);

    if (result.rowCount && result.rowCount > 0) {
      updated++;
      console.log(`  Updated tenant ${tenant_id}: ${app_count} applications`);
    } else {
      console.log(`  No subscription found for tenant ${tenant_id} (skipped)`);
    }
  }

  // Also reset counts to 0 for tenants with no applications this month
  const resetResult = await db.execute(sql`
    UPDATE tenant_subscriptions
    SET usage_applications_current_month = 0,
        updated_at = NOW()
    WHERE tenant_id NOT IN (
      SELECT DISTINCT tenant_id
      FROM applications
      WHERE submitted_at >= ${firstOfMonth}
        AND submitted_at < ${firstOfNextMonth}
    )
    AND usage_applications_current_month > 0
  `);

  const resetCount = resetResult.rowCount || 0;
  if (resetCount > 0) {
    console.log(`  Reset ${resetCount} tenants with no applications this month to 0`);
  }

  console.log(`\nSync complete:`);
  console.log(`  - ${updated} subscriptions updated with current counts`);
  console.log(`  - ${resetCount} subscriptions reset to 0`);
}

// Run the sync
syncApplicationCounts()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error syncing application counts:', error);
    process.exit(1);
  });
