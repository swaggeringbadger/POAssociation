import { storage } from "./storage";
import { provisionDemoEcosystem } from "./provision";

/**
 * Admin Script: Create Demo Code
 *
 * Creates a new demo code and provisions the complete demo ecosystem.
 *
 * Usage:
 *   tsx server/createDemoCode.ts [CODE] [LABEL] [DAYS_VALID]
 *
 * Example:
 *   tsx server/createDemoCode.ts CONF2024 "Conference 2024 Demo" 30
 */

async function createDemoCode() {
  const args = process.argv.slice(2);

  // Parse arguments with defaults
  const code = args[0] || `DEMO-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const label = args[1] || 'Test Demo';
  const daysValid = parseInt(args[2]) || 7;
  const maxUses = args[3] ? parseInt(args[3]) : null;

  console.log('\n========================================');
  console.log('  Create Demo Code');
  console.log('========================================\n');

  console.log(`Code: ${code}`);
  console.log(`Label: ${label}`);
  console.log(`Valid for: ${daysValid} days`);
  console.log(`Max uses: ${maxUses || 'unlimited'}\n`);

  try {
    // Check if code already exists
    const existing = await storage.getDemoCodeByCode(code);
    if (existing) {
      console.error(`❌ Error: Demo code "${code}" already exists!`);
      process.exit(1);
    }

    // Create demo code
    console.log('📝 Creating demo code...');
    const validFrom = new Date();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + daysValid);

    const demoCode = await storage.createDemoCode({
      code,
      label,
      validFrom,
      validUntil,
      isActive: true,
      maxUses,
      createdBy: null,
    });

    console.log('✅ Demo code created!\n');
    console.log(`ID: ${demoCode.id}`);
    console.log(`Code: ${demoCode.code}`);
    console.log(`Valid from: ${demoCode.validFrom}`);
    console.log(`Valid until: ${demoCode.validUntil}\n`);

    // Provision demo ecosystem
    console.log('🚀 Provisioning demo ecosystem...');
    console.log('   This will create:');
    console.log('   - 1 Management Company');
    console.log('   - 2 Communities');
    console.log('   - 4 Demo Users (Emily, Sarah, James, Alex)');
    console.log('   - 4 Form Templates');
    console.log('   - 30 Sample Applications\n');

    const ecosystem = await provisionDemoEcosystem(demoCode.id);

    console.log('✅ Demo ecosystem provisioned successfully!\n');
    console.log('========================================');
    console.log('  Demo Ecosystem Created');
    console.log('========================================\n');
    console.log(`🎫 Demo Code: ${demoCode.code}`);
    console.log(`🏢 Management Company: ${ecosystem.managementCompany.name}`);
    console.log(`🏘️  Communities: ${ecosystem.communities.map(c => c.name).join(', ')}`);
    console.log(`👥 Demo Users:`);
    ecosystem.users.forEach(user => {
      console.log(`   - ${user.firstName} ${user.lastName} (${user.email})`);
    });
    console.log(`📋 Form Templates: ${ecosystem.formTemplates.length}`);
    console.log(`📝 Applications: ${ecosystem.applications.length}`);
    console.log('\n========================================');
    console.log('  Quick Test Instructions');
    console.log('========================================\n');
    console.log('1. Start the dev server: npm run dev');
    console.log('2. Navigate to: http://localhost:5000/demo');
    console.log(`3. Enter demo code: ${demoCode.code}`);
    console.log('4. Select any persona to login');
    console.log('5. Explore the demo dashboard!\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error creating demo code:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
createDemoCode();
