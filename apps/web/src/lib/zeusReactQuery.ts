import { queryOptions } from '@tanstack/react-query';

import { api } from '~/lib/api';
import { zeusQueryKeys } from '~/lib/queryKeys';

export function zeusConversationQueryOptions(id: string | null) {
  return queryOptions({
    queryKey: zeusQueryKeys.conversation(id),
    queryFn: () => api.zeus.createConversation(),
    enabled: !id,
    staleTime: 0,
  });
}

export function zeusMemoryQueryOptions() {
  return queryOptions({
    queryKey: zeusQueryKeys.memory(),
    queryFn: () => api.zeus.memory(),
    staleTime: 30_000,
  });
}

export function zeusTasksQueryOptions() {
  return queryOptions({
    queryKey: zeusQueryKeys.tasks(),
    queryFn: () => api.zeus.tasks(),
    staleTime: 15_000,
  });
}
