import { sqliteTable, text, integer, real, blob } from 'drizzle-orm/sqlite-core';

// ─── Agents ────────────────────────────────────────────────────────────────

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  version: text('version').notNull(),
  description: text('description'),
  icon: text('icon'),
  color: text('color'),
  author: text('author'),
  manifestPath: text('manifest_path').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
  installedAt: integer('installed_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;

// ─── Feed Events ────────────────────────────────────────────────────────────

export const feedEvents = sqliteTable('feed_events', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').references(() => agents.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),               // 'info' | 'success' | 'warning' | 'error' | 'audio'
  title: text('title').notNull(),
  body: text('body'),
  data: text('data', { mode: 'json' }),        // arbitrary JSON payload
  audioUrl: text('audio_url'),                 // for audio feed items → RSS
  read: integer('read', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export type FeedEvent = typeof feedEvents.$inferSelect;
export type NewFeedEvent = typeof feedEvents.$inferInsert;

// ─── Zeus Memory ────────────────────────────────────────────────────────

export const zeusMemory = sqliteTable('zeus_memory', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  category: text('category').notNull(),        // 'user' | 'preference' | 'context' | 'fact'
  confidence: real('confidence').default(1.0).notNull(),
  source: text('source').notNull(),            // agent id or 'user' or 'zeus'
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export type MemoryEntry = typeof zeusMemory.$inferSelect;
export type NewMemoryEntry = typeof zeusMemory.$inferInsert;

// ─── Zeus Conversations ─────────────────────────────────────────────────

export const zeusConversations = sqliteTable('zeus_conversations', {
  id: text('id').primaryKey(),
  messages: text('messages', { mode: 'json' }).notNull(),  // Message[]
  mode: text('mode').default('chat').notNull(),             // 'chat' | 'build' | 'edit' | 'task'
  agentId: text('agent_id'),                               // if in build/edit mode
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export type Conversation = typeof zeusConversations.$inferSelect;
export type NewConversation = typeof zeusConversations.$inferInsert;

// ─── Zeus Tasks ──────────────────────────────────────────────────────────

export const zeusTasks = sqliteTable('zeus_tasks', {
  id: text('id').primaryKey(),
  requesterId: text('requester_id').notNull(),  // agent id or 'user'
  goal: text('goal').notNull(),
  context: text('context', { mode: 'json' }),
  deliverables: text('deliverables', { mode: 'json' }),
  priority: text('priority').default('normal').notNull(),   // 'low' | 'normal' | 'high'
  requiresApproval: integer('requires_approval', { mode: 'boolean' }).default(false).notNull(),
  status: text('status').default('pending').notNull(),      // 'pending' | 'running' | 'done' | 'failed' | 'awaiting_approval'
  result: text('result', { mode: 'json' }),
  callbackEndpoint: text('callback_endpoint'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export type ZeusTask = typeof zeusTasks.$inferSelect;
export type NewZeusTask = typeof zeusTasks.$inferInsert;

// ─── Agent Secrets ───────────────────────────────────────────────────────────

export const agentSecrets = sqliteTable('agent_secrets', {
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  value: text('value').notNull(),    // plaintext for now, encrypt later
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

// ─── User Config ─────────────────────────────────────────────────────────────

export const userConfig = sqliteTable('user_config', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
