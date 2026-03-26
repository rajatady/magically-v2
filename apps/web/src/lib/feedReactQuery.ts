import { queryOptions } from '@tanstack/react-query';

import { api } from '~/lib/api';
import { feedQueryKeys } from '~/lib/queryKeys';

export function feedQueryOptions(limit = 50) {
  return queryOptions({
    queryKey: feedQueryKeys.list(limit),
    queryFn: () => api.feed.list(limit),
    staleTime: 10_000,
  });
}
