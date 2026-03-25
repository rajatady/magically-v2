import { z } from 'zod';

// ─── Agent Manifest ──────────────────────────────────────────────────────────

// ─── Trigger Types ──────────────────────────────────────────────────────────

export const CronTriggerSchema = z.object({
  type: z.literal('cron'),
  name: z.string(),
  entrypoint: z.string(),                   // function name to invoke
  schedule: z.string(),                     // cron expression
});

export const EventTriggerSchema = z.object({
  type: z.literal('event'),
  name: z.string(),
  entrypoint: z.string(),
  event: z.string(),                        // event name e.g. 'agent:recipe-book:recipe-added'
});

export const WebhookTriggerSchema = z.object({
  type: z.literal('webhook'),
  name: z.string(),
  entrypoint: z.string(),
});

export const TriggerSchema = z.discriminatedUnion('type', [
  CronTriggerSchema,
  EventTriggerSchema,
  WebhookTriggerSchema,
]);

export const AgentUISchema = z.object({
  entry: z.string(),                        // path to App.tsx
  widget: z.string().optional(),            // path to widget.json
});

export const AgentPermissionsSchema = z.object({
  data: z.array(z.string()).default([]),
  actions: z.array(z.string()).default([]),
  memory: z.enum(['read', 'read-write', 'none']).default('none'),
  network: z.boolean().default(false),
});

export const AgentRuntimeSchema = z.object({
  base: z.string(),                              // Docker base image e.g. "python:3.12-slim"
  system: z.array(z.string()).default([]),        // apt packages e.g. ["chromium", "ffmpeg"]
  install: z.string().optional(),                 // install command e.g. "pip install -r requirements.txt"
});

export const AgentFunctionSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.unknown()),        // JSON Schema
  returns: z.record(z.unknown()).optional(),
  run: z.string().optional(),               // container command e.g. "python greet.py"
});

export const AgentManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  author: z.string().optional(),
  tools: z.array(z.string()).default([]),
  triggers: z.array(TriggerSchema).default([]),
  ui: AgentUISchema.optional(),
  permissions: AgentPermissionsSchema.optional(),
  secrets: z.array(z.string()).default([]),         // declared secret names the agent needs
  runtime: AgentRuntimeSchema.optional(),            // if set → container agent; if absent → lightweight
  functions: z.array(AgentFunctionSchema).default([]),
  remixOf: z.string().optional(),
});

export type AgentManifest = z.infer<typeof AgentManifestSchema>;
export type AgentTrigger = z.infer<typeof TriggerSchema>;
export type CronTrigger = z.infer<typeof CronTriggerSchema>;
export type EventTrigger = z.infer<typeof EventTriggerSchema>;
export type WebhookTrigger = z.infer<typeof WebhookTriggerSchema>;
export type AgentUI = z.infer<typeof AgentUISchema>;
export type AgentPermissions = z.infer<typeof AgentPermissionsSchema>;
export type AgentFunction = z.infer<typeof AgentFunctionSchema>;

// ─── Agent Runtime State ─────────────────────────────────────────────────────

export interface AgentInstance {
  manifest: AgentManifest;
  dir: string;           // absolute path to agent directory
  enabled: boolean;
  installedAt: Date;
}

// ─── Agent Action ────────────────────────────────────────────────────────────

export const AgentActionSchema = z.object({
  action: z.string(),
  payload: z.record(z.unknown()).optional(),
});

export type AgentAction = z.infer<typeof AgentActionSchema>;
