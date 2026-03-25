import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'path';

const TEST_DB = 'magically_v2_test';
const TEST_DB_URL = `postgres://localhost:5432/${TEST_DB}`;
const ADMIN_URL = 'postgres://localhost:5432/postgres';

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
