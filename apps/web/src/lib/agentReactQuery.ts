import { queryOptions } from '@tanstack/react-query';

import { api } from '~/lib/api';
import { agentQueryKeys } from '~/lib/queryKeys';

export function agentsQueryOptions() {
  return queryOptions({
    queryKey: agentQueryKeys.list(),
    queryFn: () => api.agents.list(),
    staleTime: 30_000,
  });
}

export function agentDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: agentQueryKeys.detail(id),
    queryFn: () => api.agents.get(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}
