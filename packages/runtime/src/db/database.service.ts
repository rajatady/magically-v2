import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { join } from 'path';
import * as schema from './schema.js';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private sqlite: Database.Database;
  db: BetterSQLite3Database<typeof schema>;

  constructor() {
    const dbPath = process.env.DB_PATH ?? join(process.cwd(), 'magically.db');
    this.logger.log(`Opening database at ${dbPath}`);

    this.sqlite = new Database(dbPath);
    // WAL mode: better concurrent read performance
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('foreign_keys = ON');

    this.db = drizzle(this.sqlite, { schema });
    this.runMigrations();
  }

  /** Called by tests to re-init with a different DB_PATH */
  onModuleInit() {}

  private runMigrations() {
    // Create tables if they don't exist (simple bootstrap)
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        version TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        color TEXT,
        author TEXT,
        manifest_path TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        installed_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS feed_events (
        id TEXT PRIMARY KEY,
        agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        data TEXT,
        audio_url TEXT,
        read INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS zeus_memory (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        category TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 1.0,
        source TEXT NOT NULL,
        expires_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS zeus_conversations (
        id TEXT PRIMARY KEY,
        messages TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'chat',
        agent_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS zeus_tasks (
        id TEXT PRIMARY KEY,
        requester_id TEXT NOT NULL,
        goal TEXT NOT NULL,
        context TEXT,
        deliverables TEXT,
        priority TEXT NOT NULL DEFAULT 'normal',
        requires_approval INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        result TEXT,
        callback_endpoint TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agent_secrets (
        agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (agent_id, key)
      );

      CREATE TABLE IF NOT EXISTS user_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    this.logger.log('Database schema ready');
  }

  onModuleDestroy() {
    this.sqlite?.close();
  }

  /** Convenience: run a raw SQL statement (useful in tests) */
  exec(sql: string) {
    this.sqlite.exec(sql);
  }
}
