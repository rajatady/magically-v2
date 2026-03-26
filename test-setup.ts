/**
 * Bun test preload script.
 * Sets DATABASE_URL for runtime tests and ensures the test DB exists with migrations.
 */
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'path';

const TEST_DB = 'magically_v2_test';
const TEST_DB_URL = `postgres://localhost:5432/${TEST_DB}`;

// Point all tests at the test database
process.env.DATABASE_URL = TEST_DB_URL;

// Create + migrate test DB once per process
if (!(globalThis as any).__magicallyTestDbReady) {
  (globalThis as any).__magicallyTestDbReady = true;

  const adminPool = new Pool({ connectionString: 'postgres://localhost:5432/postgres' });
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

  const testPool = new Pool({ connectionString: TEST_DB_URL });
  try {
    const db = drizzle(testPool);
    await migrate(db, {
      migrationsFolder: join(import.meta.dir, 'packages', 'runtime', 'drizzle'),
    });
  } finally {
    await testPool.end();
  }
}
