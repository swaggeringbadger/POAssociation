import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { applications } from '@shared/schema';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

async function clearApplications() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const db = drizzle({ client: pool });

  console.log('Clearing applications table...');
  await db.delete(applications);
  console.log('Applications cleared successfully');
  await pool.end();
}

clearApplications().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
