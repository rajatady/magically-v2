import { pgTable, text, boolean, timestamp, real, jsonb, primaryKey } from 'drizzle-orm/pg-core';

// ─── Agents ────────────────────────────────────────────────────────────────

export const agents = pgTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  version: text('version').notNull(),
  description: text('description'),
  icon: text('icon'),
  color: text('color'),
  author: text('author'),
  manifestPath: text('manifest_path').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  installedAt: timestamp('installed_at').notNull(),
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

// ─── User Config ─────────────────────────────────────────────────────────────

export const userConfig = pgTable('user_config', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});
