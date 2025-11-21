import { storage } from "./storage";

/**
 * Purge Script for Expired Demo Ecosystems
 *
 * This script finds and deletes demo codes that have expired (validUntil < NOW()).
 * The CASCADE delete constraint automatically removes:
 * - All demo users
 * - All demo tenants (management companies and communities)
 * - All user-tenant roles
 * - All form templates
 * - All applications
 * - All demo sessions
 *
 * Production data (demoCodeId = NULL) is never affected.
 *
 * Can be run manually via: node --loader ts-node/esm server/purgeExpiredDemos.ts
 * Or scheduled as a cron job
 */

interface PurgeResult {
  deletedCount: number;
  codes: Array<{
    id: string;
    code: string;
    label: string;
    validUntil: Date;
    currentUses: number;
  }>;
}

export async function purgeExpiredDemos(dryRun: boolean = false): Promise<PurgeResult> {
  console.log(`\n🧹 Starting demo ecosystem purge${dryRun ? ' (DRY RUN)' : ''}...`);

  try {
    // Find all expired demo codes
    const allDemoCodes = await storage.listDemoCodes();
    const now = new Date();

    const expiredCodes = allDemoCodes.filter(code => {
      const validUntil = new Date(code.validUntil);
      return validUntil < now;
    });

    if (expiredCodes.length === 0) {
      console.log('✅ No expired demo codes found. Nothing to purge.');
      return {
        deletedCount: 0,
        codes: [],
      };
    }

    console.log(`\n📋 Found ${expiredCodes.length} expired demo code(s):\n`);

    const result: PurgeResult = {
      deletedCount: 0,
      codes: [],
    };

    for (const code of expiredCodes) {
      const validUntil = new Date(code.validUntil);
      const daysExpired = Math.floor((now.getTime() - validUntil.getTime()) / (1000 * 60 * 60 * 24));

      console.log(`  🗑️  ${code.code} (${code.label})`);
      console.log(`      Expired: ${validUntil.toISOString()} (${daysExpired} days ago)`);
      console.log(`      Usage: ${code.currentUses} / ${code.maxUses || '∞'}`);

      if (!dryRun) {
        try {
          // Get stats before deletion
          const stats = await storage.getDemoSessionStats(code.id);
          console.log(`      Sessions: ${stats.totalSessions || 0}, Users: ${stats.uniqueUsers || 0}`);

          // Delete the demo code (cascade deletes entire ecosystem)
          await storage.deleteDemoCode(code.id);

          console.log(`      ✅ Deleted successfully`);
          result.deletedCount++;
          result.codes.push({
            id: code.id,
            code: code.code,
            label: code.label,
            validUntil: code.validUntil,
            currentUses: code.currentUses,
          });
        } catch (error: any) {
          console.error(`      ❌ Failed to delete: ${error.message}`);
        }
      } else {
        console.log(`      🔍 Would delete (dry run mode)`);
        result.codes.push({
          id: code.id,
          code: code.code,
          label: code.label,
          validUntil: code.validUntil,
          currentUses: code.currentUses,
        });
      }

      console.log('');
    }

    if (!dryRun) {
      console.log(`\n✅ Purge complete! Deleted ${result.deletedCount} expired demo ecosystem(s).`);
    } else {
      console.log(`\n🔍 Dry run complete! Would delete ${expiredCodes.length} expired demo ecosystem(s).`);
    }

    return result;
  } catch (error: any) {
    console.error('\n❌ Purge failed:', error);
    throw error;
  }
}

/**
 * Purge inactive demo codes (not expired, but marked as inactive)
 */
export async function purgeInactiveDemos(dryRun: boolean = false): Promise<PurgeResult> {
  console.log(`\n🧹 Starting inactive demo ecosystem purge${dryRun ? ' (DRY RUN)' : ''}...`);

  try {
    const allDemoCodes = await storage.listDemoCodes();
    const inactiveCodes = allDemoCodes.filter(code => !code.isActive);

    if (inactiveCodes.length === 0) {
      console.log('✅ No inactive demo codes found. Nothing to purge.');
      return {
        deletedCount: 0,
        codes: [],
      };
    }

    console.log(`\n📋 Found ${inactiveCodes.length} inactive demo code(s):\n`);

    const result: PurgeResult = {
      deletedCount: 0,
      codes: [],
    };

    for (const code of inactiveCodes) {
      console.log(`  🗑️  ${code.code} (${code.label})`);
      console.log(`      Status: Inactive`);
      console.log(`      Created: ${new Date(code.createdAt).toISOString()}`);

      if (!dryRun) {
        try {
          await storage.deleteDemoCode(code.id);
          console.log(`      ✅ Deleted successfully`);
          result.deletedCount++;
          result.codes.push({
            id: code.id,
            code: code.code,
            label: code.label,
            validUntil: code.validUntil,
            currentUses: code.currentUses,
          });
        } catch (error: any) {
          console.error(`      ❌ Failed to delete: ${error.message}`);
        }
      } else {
        console.log(`      🔍 Would delete (dry run mode)`);
        result.codes.push({
          id: code.id,
          code: code.code,
          label: code.label,
          validUntil: code.validUntil,
          currentUses: code.currentUses,
        });
      }

      console.log('');
    }

    if (!dryRun) {
      console.log(`\n✅ Purge complete! Deleted ${result.deletedCount} inactive demo ecosystem(s).`);
    } else {
      console.log(`\n🔍 Dry run complete! Would delete ${inactiveCodes.length} inactive demo ecosystem(s).`);
    }

    return result;
  } catch (error: any) {
    console.error('\n❌ Purge failed:', error);
    throw error;
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const includeInactive = args.includes('--inactive');

  console.log('\n========================================');
  console.log('  Demo Ecosystem Purge Script');
  console.log('========================================');

  (async () => {
    try {
      // Purge expired demos
      const expiredResult = await purgeExpiredDemos(dryRun);

      // Optionally purge inactive demos
      if (includeInactive) {
        const inactiveResult = await purgeInactiveDemos(dryRun);
      }

      console.log('\n========================================');
      console.log('  Purge Complete');
      console.log('========================================\n');

      process.exit(0);
    } catch (error) {
      console.error('\n❌ Purge script failed:', error);
      process.exit(1);
    }
  })();
}
