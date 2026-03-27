import { z } from 'zod';

const uiMessagePartSchema = z.object({
  type: z.string(),
}).passthrough();

const uiMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string().optional(),
  parts: z.array(uiMessagePartSchema).optional(),
}).passthrough();

export const chatRequestSchema = z.object({
  messages: z.array(uiMessageSchema),
  conversationId: z.string().uuid().optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
