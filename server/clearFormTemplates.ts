import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { formTemplates } from '@shared/schema';

const { Pool } = pg;

async function clearFormTemplates() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });
  const db = drizzle(pool);

  console.log('Clearing form_templates table...');
  await db.delete(formTemplates);
  console.log('Form templates cleared successfully');
  await pool.end();
}

clearFormTemplates().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
