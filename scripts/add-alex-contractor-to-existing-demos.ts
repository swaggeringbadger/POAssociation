/**
 * Migration Script: Add Contractor Profile to Alex Rivera in Existing Demos
 *
 * This script updates all existing demo sandboxes to give Alex Rivera
 * a contractor profile for "Rivera Landscaping & Design".
 *
 * Run with: npx tsx scripts/add-alex-contractor-to-existing-demos.ts
 */

import { storage } from "../server/storage";

async function addAlexContractorToExistingDemos() {
  console.log("🔧 Adding contractor profiles to existing Alex users...\n");

  const demoCodes = await storage.listDemoCodes();
  let updated = 0, skipped = 0, errors = 0;

  console.log(`Found ${demoCodes.length} demo codes to process\n`);

  for (const demoCode of demoCodes) {
    const suffix = demoCode.id.slice(-8);
    const alexUserId = `${demoCode.id}-user-contributor`;

    try {
      // Check if contractor profile already exists
      const existing = await storage.getContractorByUserId(alexUserId);
      if (existing) {
        console.log(`⏭️  ${demoCode.code}: Alex already has contractor profile`);
        skipped++;
        continue;
      }

      // Check if the Alex user actually exists (demo might be incomplete)
      const alexUser = await storage.getUser(alexUserId);
      if (!alexUser) {
        console.log(`⏭️  ${demoCode.code}: Alex user not found (incomplete demo?)`);
        skipped++;
        continue;
      }

      // Create contractor profile
      const contractor = await storage.createContractor({
        userId: alexUserId,
        companyName: "Rivera Landscaping & Design",
        businessType: "landscaper",
        areasOfExpertise: ["landscaping", "fencing", "outdoor_structures"],
        licenseNumber: `LC-${suffix.toUpperCase()}-2024`,
        isLicenseVerified: true,
        businessPhone: "(555) 234-5678",
        businessEmail: `alex.contractor-${suffix}@poassociation.com`,
        website: "https://riveralandscaping.example.com",
        serviceArea: "Greater Metro Area",
        isPubliclySearchable: true,
        referralCode: `RIVERA${suffix.slice(-4).toUpperCase()}`,
        referralCodeCreatedAt: new Date(),
        demoCodeId: demoCode.id,
      });

      console.log(`✅ ${demoCode.code}: Created contractor profile for Alex (ID: ${contractor.id})`);
      updated++;

    } catch (error: any) {
      console.error(`❌ ${demoCode.code}: Error - ${error.message}`);
      errors++;
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 Summary:`);
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`${'='.repeat(50)}\n`);

  process.exit(errors > 0 ? 1 : 0);
}

addAlexContractorToExistingDemos().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
