import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { notifyGlobalError } from "@/lib/errors";

function isClientError(error: unknown) {
  const status = (error as { status?: number } | null)?.status;
  return typeof status === "number" && status >= 400 && status < 500;
}

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => notifyGlobalError(error, () => void query.fetch()),
    }),
    mutationCache: new MutationCache({
      onError: (error) => notifyGlobalError(error),
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => !isClientError(error) && failureCount < 2,
      },
      mutations: { retry: false },
    },
  });
}
