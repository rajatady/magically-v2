import { queryOptions } from '@tanstack/react-query';

import { api } from '~/lib/api';
import { configQueryKeys } from '~/lib/queryKeys';

export function configQueryOptions() {
  return queryOptions({
    queryKey: configQueryKeys.config(),
    queryFn: () => api.config.get(),
    staleTime: 60_000,
  });
}
