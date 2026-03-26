import { pgTable, text, boolean, timestamp, real, jsonb, primaryKey, integer } from 'drizzle-orm/pg-core';

// ─── Agents ────────────────────────────────────────────────────────────────
// Single source of truth for all agents — published via registry, not filesystem.

export const agents = pgTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  color: text('color'),
  authorId: text('author_id').references(() => users.id),
  category: text('category'),
  tags: jsonb('tags').$type<string[]>().default([]),
  latestVersion: text('latest_version').notNull(),
  status: text('status').notNull().default('live'),
  installs: integer('installs').notNull().default(0),
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;

// ─── Feed Events ────────────────────────────────────────────────────────────

export const feedEvents = pgTable('feed_events', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').references(() => agents.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  data: jsonb('data'),
  audioUrl: text('audio_url'),
  read: boolean('read').default(false).notNull(),
  createdAt: timestamp('created_at').notNull(),
});

export type FeedEvent = typeof feedEvents.$inferSelect;
export type NewFeedEvent = typeof feedEvents.$inferInsert;

// ─── Zeus Memory ────────────────────────────────────────────────────────

export const zeusMemory = pgTable('zeus_memory', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  category: text('category').notNull(),
  confidence: real('confidence').default(1.0).notNull(),
  source: text('source').notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export type MemoryEntry = typeof zeusMemory.$inferSelect;
export type NewMemoryEntry = typeof zeusMemory.$inferInsert;

// ─── Zeus Conversations ─────────────────────────────────────────────────

export const zeusConversations = pgTable('zeus_conversations', {
  id: text('id').primaryKey(),
  messages: jsonb('messages').notNull(),
  mode: text('mode').default('chat').notNull(),
  agentId: text('agent_id'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export type Conversation = typeof zeusConversations.$inferSelect;
export type NewConversation = typeof zeusConversations.$inferInsert;

// ─── Zeus Tasks ──────────────────────────────────────────────────────────

export const zeusTasks = pgTable('zeus_tasks', {
  id: text('id').primaryKey(),
  requesterId: text('requester_id').notNull(),
  goal: text('goal').notNull(),
  context: jsonb('context'),
  deliverables: jsonb('deliverables'),
  priority: text('priority').default('normal').notNull(),
  requiresApproval: boolean('requires_approval').default(false).notNull(),
  status: text('status').default('pending').notNull(),
  result: jsonb('result'),
  callbackEndpoint: text('callback_endpoint'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export type ZeusTask = typeof zeusTasks.$inferSelect;
export type NewZeusTask = typeof zeusTasks.$inferInsert;

// ─── Agent Secrets ───────────────────────────────────────────────────────────

export const agentSecrets = pgTable('agent_secrets', {
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.agentId, table.key] }),
]);

// ─── Agent Runs ──────────────────────────────────────────────────────────────

export const agentRuns = pgTable('agent_runs', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  functionName: text('function_name').notNull(),
  triggerType: text('trigger_type').notNull(),         // 'schedule' | 'event' | 'manual' | 'programmatic'
  triggerSource: text('trigger_source'),                // cron expression, event name, etc.
  status: text('status').notNull().default('queued'),   // 'queued' | 'running' | 'success' | 'error'
  computeProvider: text('compute_provider'),             // 'in-process' | 'docker' | 'fly'
  exitCode: integer('exit_code'),
  result: jsonb('result'),
  error: text('error'),
  logs: jsonb('logs'),                                  // RunLog[]
  durationMs: integer('duration_ms'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull(),
});

export type AgentRun = typeof agentRuns.$inferSelect;
export type NewAgentRun = typeof agentRuns.$inferInsert;

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),             // null for OAuth-only users
  name: text('name'),
  avatarUrl: text('avatar_url'),
  provider: text('provider').notNull().default('local'),  // 'google' | 'local'
  providerId: text('provider_id'),                 // Google sub ID
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ─── API Keys ────────────────────────────────────────────────────────────────

export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  keyHash: text('key_hash').notNull(),
  keyPrefix: text('key_prefix').notNull(),     // first 8 chars for display: "mg_abc123..."
  name: text('name').notNull(),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').notNull(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

// ─── Agent Versions ─────────────────────────────────────────────────────────

export const agentVersions = pgTable('agent_versions', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  version: text('version').notNull(),
  manifest: jsonb('manifest').notNull(),
  bundleUrl: text('bundle_url'),                           // S3/Tigris URL to tarball
  imageRef: text('image_ref'),                             // Primary image ref (GHCR)
  flyImageRef: text('fly_image_ref'),                      // Fly registry copy
  changelog: text('changelog'),
  status: text('status').notNull().default('processing'),  // processing | building | live | failed
  buildError: text('build_error'),                         // failure message when status = failed
  publishedAt: timestamp('published_at').notNull(),
});

export type AgentVersion = typeof agentVersions.$inferSelect;
export type NewAgentVersion = typeof agentVersions.$inferInsert;

// Keep aliases for backward compat during migration
export const registryVersions = agentVersions;

// ─── User Agent Installs ────────────────────────────────────────────────────

export const userAgentInstalls = pgTable('user_agent_installs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  agentId: text('agent_id').notNull().references(() => agents.id),
  version: text('version').notNull(),
  config: jsonb('config').$type<Record<string, unknown>>().default({}),
  enabled: boolean('enabled').notNull().default(true),
  installedAt: timestamp('installed_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export type UserAgentInstallRow = typeof userAgentInstalls.$inferSelect;
export type NewUserAgentInstall = typeof userAgentInstalls.$inferInsert;

// ─── User Config ─────────────────────────────────────────────────────────────

export const userConfig = pgTable('user_config', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});
