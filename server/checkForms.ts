import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { formTemplates, tenants } from '@shared/schema';

const { Pool } = pg;

async function checkForms() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });
  const db = drizzle(pool);

  console.log('Checking form templates in database...\n');

  // Get all tenants
  const allTenants = await db.select().from(tenants);
  console.log('Tenants:');
  allTenants.forEach(t => {
    console.log(`  - ${t.name} (${t.subdomain}): ${t.id}`);
  });

  console.log('\n---\n');

  // Get all form templates
  const allForms = await db.select().from(formTemplates);
  console.log(`Form templates (${allForms.length} total):`);
  allForms.forEach(f => {
    console.log(`  - ${f.projectType} v${f.version} (active: ${f.isActive})`);
    console.log(`    tenantId: ${f.tenantId}`);
    console.log(`    name: ${f.name}`);
    console.log('');
  });

  await pool.end();
}

checkForms().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
