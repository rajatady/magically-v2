// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  provider?: string;
}

export interface AuthResult {
  user: AuthUser;
  accessToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  name?: string;
}

export interface ApiKeyResult {
  rawKey: string;
  apiKey: { id: string; name: string; keyPrefix: string };
}

// ─── Agents ──────────────────────────────────────────────────────────────────

export interface AgentFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  returns?: Record<string, unknown>;
  run?: string;
}

export interface AgentSummary {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  color?: string;
  author?: string;
  enabled: boolean;
  hasWidget: boolean;
  functions: AgentFunction[];
}

// ─── Triggers ────────────────────────────────────────────────────────────────

export interface CronTrigger {
  type: 'cron';
  name: string;
  entrypoint: string;
  schedule: string;
}

export interface EventTrigger {
  type: 'event';
  name: string;
  entrypoint: string;
  event: string;
}

export interface WebhookTrigger {
  type: 'webhook';
  name: string;
  entrypoint: string;
}

export type AgentTrigger = CronTrigger | EventTrigger | WebhookTrigger;

// ─── Runs ────────────────────────────────────────────────────────────────────

export interface RunLog {
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export interface RunResult {
  runId?: string;
  agentId: string;
  functionName: string;
  status: 'success' | 'error';
  result?: unknown;
  error?: string;
  logs: RunLog[];
  durationMs: number;
  startedAt: number;
}

// ─── Feed ────────────────────────────────────────────────────────────────────

export type FeedItemType = 'info' | 'success' | 'warning' | 'error' | 'audio';

export interface FeedItem {
  id: string;
  agentId?: string;
  type: FeedItemType;
  title: string;
  body?: string;
  data?: unknown;
  audioUrl?: string;
  read: boolean;
  createdAt: string;
}

// ─── Registry ───────────────────────────────────────────────────────────────

export type RegistryAgentStatus = 'draft' | 'live' | 'deprecated' | 'yanked';

export interface ConfigField {
  type: 'string' | 'number' | 'boolean' | 'array' | 'text';
  label: string;
  required?: boolean;
  default?: unknown;
}

export interface RegistryAgent {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  author: string;
  category?: string;
  tags?: string[];
  latestVersion: string;
  status: RegistryAgentStatus;
  installs: number;
  createdAt: string;
  updatedAt: string;
}

export interface RegistryVersion {
  id: string;
  agentId: string;
  version: string;
  manifest: Record<string, unknown>;
  bundleUrl?: string;
  imageRef?: string;
  changelog?: string;
  status: RegistryAgentStatus;
  publishedAt: string;
}

export interface UserAgentInstall {
  id: string;
  userId: string;
  agentId: string;
  version: string;
  config: Record<string, unknown>;
  enabled: boolean;
  installedAt: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

export interface AppConfig {
  hasApiKey: boolean;
  defaultModel?: string;
  zeusName?: string;
  theme?: string;
  accentColor?: string;
}

// ─── Zeus ────────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  category: string;
  source: string;
}

export interface ZeusTask {
  id: string;
  requesterId: string;
  goal: string;
  status: string;
  priority: string;
  createdAt: string;
}
