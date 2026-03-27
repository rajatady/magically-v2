import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'path';

// Use DATABASE_URL from env (CI sets this with credentials), fall back to local dev default
const envUrl = process.env.DATABASE_URL;
const TEST_DB_URL = envUrl ?? 'postgres://localhost:5432/magically_v2_test';

// Parse the base URL (without db name) for admin connection to create the test DB
const parsed = new URL(TEST_DB_URL);
const TEST_DB = parsed.pathname.replace('/', '');
parsed.pathname = '/postgres';
const ADMIN_URL = parsed.toString();

export default async function globalSetup() {
  // Create test DB if it doesn't exist
  const adminPool = new Pool({ connectionString: ADMIN_URL });

  try {
    const result = await adminPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [TEST_DB],
    );

    if (result.rows.length === 0) {
      await adminPool.query(`CREATE DATABASE "${TEST_DB}"`);
      console.log(`Created test database: ${TEST_DB}`);
    }
  } finally {
    await adminPool.end();
  }

  // Run migrations against the test DB
  const testPool = new Pool({ connectionString: TEST_DB_URL });

  try {
    const db = drizzle(testPool);
    await migrate(db, { migrationsFolder: join(__dirname, '..', 'drizzle') });
  } finally {
    await testPool.end();
  }
}
