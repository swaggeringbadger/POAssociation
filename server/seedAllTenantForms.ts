/**
 * Seed form configurations for ALL Markland POA tenants
 */

import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { eq, like } from "drizzle-orm";
import { formTemplates, tenants } from '@shared/schema';
import type { AdditionalInfoConfig } from '@shared/additionalInfoTypes';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle({ client: pool });

// Simplified form config template
function getSimpleConfig(projectType: string): AdditionalInfoConfig {
  const title = projectType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' Application';
  return {
    title,
    description: `Provide details about your ${projectType.replace('-', ' ')} project`,
    sections: [{
      title: "Project Details",
      fields: [
        {
          id: "description",
          label: "Project Description",
          type: "textarea",
          required: true,
          placeholder: "Describe your project in detail",
          description: "Provide detailed information about your planned work"
        },
        {
          id: "start_date",
          label: "Estimated Start Date",
          type: "date",
          required: true,
          description: "When will work begin?"
        },
        {
          id: "completion_date",
          label: "Estimated Completion Date",
          type: "date",
          required: false,
          description: "When do you expect to finish?"
        }
      ]
    }],
    required_documents: ["Project plans or drawings", "Photos of current condition"],
    scoring_weights: { description: 50, start_date: 30, completion_date: 20 }
  };
}

async function seedAllTenantForms() {
  console.log('Seeding forms for all Markland POA tenants...\n');

  try {
    // Get all Markland POA tenants (original and demo ones)
    const marklandTenants = await db
      .select()
      .from(tenants)
      .where(like(tenants.subdomain, 'markland%'));

    console.log(`Found ${marklandTenants.length} Markland POA tenants:\n`);
    marklandTenants.forEach(t => {
      console.log(`  - ${t.name} (${t.subdomain}): ${t.id}`);
    });

    console.log('\n---\n');

    // For each tenant, check if they have forms, and seed if not
    for (const tenant of marklandTenants) {
      console.log(`Checking tenant: ${tenant.subdomain}`);

      const existing = await db
        .select()
        .from(formTemplates)
        .where(eq(formTemplates.tenantId, tenant.id));

      if (existing.length > 0) {
        console.log(`  ✓ Already has ${existing.length} forms, skipping\n`);
        continue;
      }

      console.log(`  Seeding 6 form templates...`);

      // Seed all 6 project types
      const projectTypes = [
        'exterior-modifications',
        'structural-changes',
        'landscaping',
        'fencing',
        'outdoor-structures',
        'signage'
      ];

      for (const projectType of projectTypes) {
        const config = getSimpleConfig(projectType);

        await db.insert(formTemplates).values({
          tenantId: tenant.id,
          projectType,
          version: 1,
          name: config.title,
          description: config.description,
          schema: config as any,
          isActive: true,
          createdByUserId: null,
          activatedAt: new Date(),
          activatedByUserId: null,
        });

        console.log(`    ✓ ${projectType}`);
      }

      console.log(`  ✓ Seeded all forms for ${tenant.subdomain}\n`);
    }

    console.log('\n✅ All tenants now have form templates!');

  } catch (error) {
    console.error('\n❌ Error seeding forms:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

seedAllTenantForms().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
