import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'path';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  console.log('Running migrations...');
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  await migrate(db, { migrationsFolder: join(__dirname, '..', 'drizzle') });

  console.log('Migrations applied successfully');
  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
