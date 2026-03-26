/**
 * Query key factories for React Query cache management.
 *
 * All server-state queries use these factories to ensure consistent,
 * collision-free cache keys. Follows the pattern:
 *   - `all` — base key for bulk invalidation
 *   - `lists()` — key for list queries
 *   - `detail(id)` — key for single-item queries
 */

export const agentQueryKeys = {
  all: ['agents'] as const,
  list: () => [...agentQueryKeys.all, 'list'] as const,
  detail: (id: string) => [...agentQueryKeys.all, 'detail', id] as const,
  widget: (id: string) => [...agentQueryKeys.all, 'widget', id] as const,
} as const;

export const feedQueryKeys = {
  all: ['feed'] as const,
  list: (limit?: number) =>
    [...feedQueryKeys.all, 'list', limit] as const,
} as const;

export const zeusQueryKeys = {
  all: ['zeus'] as const,
  conversations: () => [...zeusQueryKeys.all, 'conversations'] as const,
  conversation: (id: string | null) =>
    [...zeusQueryKeys.all, 'conversation', id] as const,
  memory: () => [...zeusQueryKeys.all, 'memory'] as const,
  tasks: () => [...zeusQueryKeys.all, 'tasks'] as const,
} as const;

export const configQueryKeys = {
  all: ['config'] as const,
  config: () => [...configQueryKeys.all, 'current'] as const,
} as const;
