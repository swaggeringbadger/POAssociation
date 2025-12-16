/**
 * Seed Community Tiers
 *
 * Ensures the community_tiers table has correct values.
 * Called on server startup to keep database in sync with code defaults.
 */

import { db } from './storage';
import { eq } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { COMMUNITY_TIER_DEFAULTS, type CommunityTierCode } from '@shared/subscriptionTypes';

/**
 * Seed or update community tiers from code defaults
 * Uses upsert logic to update existing tiers or insert missing ones
 */
export async function seedCommunityTiers(): Promise<void> {
  console.log('[SeedTiers] Checking community tiers...');

  const tierCodes: CommunityTierCode[] = ['small', 'medium', 'large', 'xl'];

  for (const tierCode of tierCodes) {
    const defaults = COMMUNITY_TIER_DEFAULTS[tierCode];

    // Check if tier exists
    const [existing] = await db
      .select()
      .from(schema.communityTiers)
      .where(eq(schema.communityTiers.tierCode, tierCode))
      .limit(1);

    if (existing) {
      // Update existing tier to match code defaults
      const needsUpdate =
        existing.includedCredits !== defaults.includedCredits ||
        parseFloat(existing.defaultOverageCost) !== defaults.defaultOverageCost ||
        parseFloat(existing.basePriceMonthly) !== defaults.basePriceMonthly ||
        parseFloat(existing.basePriceYearly) !== defaults.basePriceYearly;

      if (needsUpdate) {
        await db
          .update(schema.communityTiers)
          .set({
            name: defaults.name,
            minDoors: defaults.minDoors,
            maxDoors: defaults.maxDoors,
            basePriceMonthly: defaults.basePriceMonthly.toFixed(2),
            basePriceYearly: defaults.basePriceYearly.toFixed(2),
            includedCredits: defaults.includedCredits,
            defaultOverageCost: defaults.defaultOverageCost.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(schema.communityTiers.tierCode, tierCode));

        console.log(`[SeedTiers] Updated tier: ${tierCode}`);
      }
    } else {
      // Insert new tier
      await db.insert(schema.communityTiers).values({
        tierCode,
        name: defaults.name,
        minDoors: defaults.minDoors,
        maxDoors: defaults.maxDoors,
        basePriceMonthly: defaults.basePriceMonthly.toFixed(2),
        basePriceYearly: defaults.basePriceYearly.toFixed(2),
        includedCredits: defaults.includedCredits,
        defaultOverageCost: defaults.defaultOverageCost.toFixed(2),
        sortOrder: tierCodes.indexOf(tierCode) + 1,
        isActive: true,
      });

      console.log(`[SeedTiers] Created tier: ${tierCode}`);
    }
  }

  console.log('[SeedTiers] Community tiers synced successfully');
}
