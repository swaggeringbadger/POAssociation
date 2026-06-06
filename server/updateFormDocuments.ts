/**
 * Update Form Templates with new document format
 *
 * Updates existing form templates to use the new documents field
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, and } from "drizzle-orm";
import { formTemplates, tenants } from '@shared/schema';

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });
const db = drizzle(pool);

async function updateFormDocuments() {
  console.log('Updating form templates with new document format...\n');

  try {
    // Get Markland POA tenant
    const [marklandTenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.subdomain, 'markland'))
      .limit(1);

    if (!marklandTenant) {
      console.error('❌ Markland POA tenant not found.');
      process.exit(1);
    }

    console.log(`✓ Found tenant: ${marklandTenant.name} (${marklandTenant.id})\n`);

    // Update exterior-modifications
    console.log('Updating exterior-modifications...');
    const [exteriorTemplate] = await db
      .select()
      .from(formTemplates)
      .where(
        and(
          eq(formTemplates.tenantId, marklandTenant.id),
          eq(formTemplates.projectType, 'exterior-modifications'),
          eq(formTemplates.isActive, true)
        )
      )
      .limit(1);

    if (exteriorTemplate) {
      const updatedSchema = {
        ...exteriorTemplate.schema,
        documents: [
          {
            name: "Color samples or swatches",
            required: true,
            description: "Physical or digital color samples showing exact paint/stain colors"
          },
          {
            name: "Material specifications sheets",
            required: true,
            description: "Manufacturer specifications and product data sheets"
          },
          {
            name: "Photos of current condition",
            required: true,
            description: "Clear photos of all areas to be modified from multiple angles"
          },
          {
            name: "Contractor information",
            required: false,
            description: "If using a contractor, provide license number, insurance, and contact info"
          },
          {
            name: "Color inspiration photos",
            required: false,
            description: "Photos of similar projects or color combinations you're considering"
          },
          {
            name: "Neighborhood context photos",
            required: false,
            description: "Photos showing how your home relates to neighboring properties"
          }
        ]
      };

      await db
        .update(formTemplates)
        .set({ schema: updatedSchema as any })
        .where(eq(formTemplates.id, exteriorTemplate.id));

      console.log('  ✓ Updated exterior-modifications template');
    }

    // Update structural-changes
    console.log('Updating structural-changes...');
    const [structuralTemplate] = await db
      .select()
      .from(formTemplates)
      .where(
        and(
          eq(formTemplates.tenantId, marklandTenant.id),
          eq(formTemplates.projectType, 'structural-changes'),
          eq(formTemplates.isActive, true)
        )
      )
      .limit(1);

    if (structuralTemplate) {
      const updatedSchema = {
        ...structuralTemplate.schema,
        documents: [
          {
            name: "Architectural plans or detailed drawings",
            required: true,
            description: "Professionally drawn plans with dimensions, elevations, and cross-sections"
          },
          {
            name: "Site plan showing location and setbacks",
            required: true,
            description: "Survey or plot plan showing structure location and distances from property lines"
          },
          {
            name: "Contractor license and insurance",
            required: true,
            description: "General contractor license, liability insurance, and workers compensation certificates"
          },
          {
            name: "Structural engineering report",
            required: true,
            description: "Stamped structural calculations and load-bearing analysis"
          },
          {
            name: "Material specifications and color samples",
            required: false,
            description: "Samples and specifications for siding, roofing, and other exterior materials"
          },
          {
            name: "Timeline and construction schedule",
            required: false,
            description: "Detailed project timeline including milestones and expected completion dates"
          },
          {
            name: "Neighbor notification letters",
            required: false,
            description: "Proof of notification to adjacent property owners about construction"
          }
        ]
      };

      await db
        .update(formTemplates)
        .set({ schema: updatedSchema as any })
        .where(eq(formTemplates.id, structuralTemplate.id));

      console.log('  ✓ Updated structural-changes template');
    }

    console.log('\n✅ Form templates updated successfully!');

  } catch (error) {
    console.error('\n❌ Error updating form templates:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the update
updateFormDocuments();
