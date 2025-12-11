/**
 * Test script for HomeHub sync connectivity
 *
 * Usage:
 *   npx tsx scripts/test-homehub-sync.ts health     - Test HomeHub connectivity
 *   npx tsx scripts/test-homehub-sync.ts features   - Fetch HomeHub's feature registry
 *   npx tsx scripts/test-homehub-sync.ts test-seed  - Test project seeding (dev only)
 */

import { sendSyncRequest, isSyncEnabled, getPartnerUrl, checkHomeHubHealth } from "../server/sync/client";

async function main() {
  const action = process.argv[2];

  console.log("=".repeat(50));
  console.log("HomeHub Sync Test Utility");
  console.log("=".repeat(50));
  console.log();

  // Check configuration
  const syncEnabled = isSyncEnabled("homehub");
  const partnerUrl = getPartnerUrl("homehub");

  console.log("Configuration:");
  console.log(`  Sync Enabled: ${syncEnabled ? "✓ Yes" : "✗ No"}`);
  console.log(`  HomeHub URL: ${partnerUrl || "(not configured)"}`);
  console.log(`  SYNC_SECRET_HOMEHUB: ${process.env.SYNC_SECRET_HOMEHUB ? "✓ Set" : "✗ Not set"}`);
  console.log();

  if (!syncEnabled) {
    console.log("⚠️  Sync is not configured. Set SYNC_SECRET_HOMEHUB environment variable.");
    console.log();
  }

  switch (action) {
    case "health":
      console.log("Testing HomeHub connectivity...");
      console.log();

      if (!syncEnabled) {
        console.log("Cannot test - sync not configured");
        process.exit(1);
      }

      const health = await checkHomeHubHealth();
      console.log("Result:");
      console.log(JSON.stringify(health, null, 2));

      if (health.success) {
        console.log();
        console.log("✓ Successfully connected to HomeHub!");
      } else {
        console.log();
        console.log("✗ Failed to connect to HomeHub");
      }
      break;

    case "features":
      console.log("Fetching HomeHub features...");
      console.log();

      const url = partnerUrl || "https://homehub.replit.app";
      try {
        const response = await fetch(`${url}/api/sync/features`);
        if (!response.ok) {
          console.log(`Error: HTTP ${response.status}`);
          const text = await response.text();
          console.log(text);
          break;
        }
        const features = await response.json();
        console.log("HomeHub features:");
        console.log(JSON.stringify(features, null, 2));
      } catch (err: any) {
        console.log(`Error fetching features: ${err.message}`);
      }
      break;

    case "test-seed":
      console.log("Testing project seed (dev only)...");
      console.log();

      if (!syncEnabled) {
        console.log("Cannot test - sync not configured");
        process.exit(1);
      }

      const result = await sendSyncRequest("homehub", "project.seed", {
        applicationId: 999,
        projectName: "Test Project from POAssociation",
        description: "This is a test sync from the POAssociation app",
        homeId: 1,
        userId: 1,
      });

      console.log("Result:");
      console.log(JSON.stringify(result, null, 2));

      if (result.success) {
        console.log();
        console.log("✓ Successfully seeded test project!");
      } else {
        console.log();
        console.log("✗ Failed to seed project");
      }
      break;

    case "local-features":
      console.log("Fetching local (POAssociation) sync features...");
      console.log();

      const { syncFeatures } = await import("../server/sync/registry");
      console.log(JSON.stringify(syncFeatures, null, 2));
      break;

    default:
      console.log(`
Usage: npx tsx scripts/test-homehub-sync.ts <command>

Commands:
  health          Test connectivity to HomeHub (requires signed request)
  features        Fetch HomeHub's feature registry (public endpoint)
  test-seed       Test project seeding to HomeHub (dev only)
  local-features  Show POAssociation's sync feature registry

Environment Variables:
  SYNC_SECRET_HOMEHUB   Shared secret for signing requests (required)
  HOMEHUB_APP_URL       HomeHub application URL (optional, defaults to homehub.replit.app)
`);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
