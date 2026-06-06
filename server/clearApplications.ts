import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { applications } from '@shared/schema';

const { Pool } = pg;

async function clearApplications() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });
  const db = drizzle(pool);

  console.log('Clearing applications table...');
  await db.delete(applications);
  console.log('Applications cleared successfully');
  await pool.end();
}

clearApplications().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
