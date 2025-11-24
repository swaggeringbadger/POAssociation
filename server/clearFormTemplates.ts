import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { formTemplates } from '@shared/schema';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

async function clearFormTemplates() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const db = drizzle({ client: pool });

  console.log('Clearing form_templates table...');
  await db.delete(formTemplates);
  console.log('Form templates cleared successfully');
  await pool.end();
}

clearFormTemplates().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
