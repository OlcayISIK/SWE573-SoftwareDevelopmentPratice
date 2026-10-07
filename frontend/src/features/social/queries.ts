import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";

import { toApiError } from "@/api/envelope";
import { toast } from "@/lib/toast";

import { socialApi, type FavoriteStatus, type FollowStatus } from "./api";

export const socialKeys = {
  favorite: (craftId: number) => ["social", "favorite", craftId] as const,
  myFavorites: (page: number) => ["social", "my-favorites", page] as const,
  allMyFavorites: ["social", "my-favorites"] as const,
  follow: (userId: number) => ["social", "follow", userId] as const,
  myFollowing: ["social", "my-following"] as const,
  myFollowers: ["social", "my-followers"] as const,
};

/**
 * Updates the cached status immediately so the button responds at once, and restores the previous
 * value if the server rejects the change.
 */
function useOptimisticToggle<T>({
  queryKey,
  request,
  optimistic,
  invalidate = [],
}: {
  queryKey: QueryKey;
  request: (next: boolean) => Promise<unknown>;
  optimistic: (current: T, next: boolean) => T;
  invalidate?: QueryKey[];
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onMutate: async (next: boolean) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<T>(queryKey);
      if (previous) {
        queryClient.setQueryData<T>(queryKey, optimistic(previous, next));
      }
      return { previous };
    },
    onError: (error, _next, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      const apiError = toApiError(error);
      if (apiError.status >= 400 && apiError.status < 500 && apiError.status !== 429) {
        toast.error(apiError.message);
      }
    },
    onSettled: () =>
      Promise.all(
        [queryKey, ...invalidate].map((key) => queryClient.invalidateQueries({ queryKey: key })),
      ),
  });
}

export function useFavoriteStatus(craftId: number, enabled = true) {
  return useQuery({
    queryKey: socialKeys.favorite(craftId),
    queryFn: () => socialApi.favoriteStatus(craftId),
    enabled,
  });
}

export function useToggleFavorite(craftId: number) {
  return useOptimisticToggle<FavoriteStatus>({
    queryKey: socialKeys.favorite(craftId),
    request: (next) => (next ? socialApi.favorite(craftId) : socialApi.unfavorite(craftId)),
    optimistic: (current, next) => ({
      favorited: next,
      favorites_count: Math.max(0, current.favorites_count + (next ? 1 : -1)),
    }),
    invalidate: [socialKeys.allMyFavorites],
  });
}

export function useMyFavorites(page: number, enabled = true) {
  return useQuery({
    queryKey: socialKeys.myFavorites(page),
    queryFn: () => socialApi.myFavorites(page),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useMyFollowing(enabled = true) {
  return useQuery({
    queryKey: socialKeys.myFollowing,
    queryFn: () => socialApi.myFollowing(),
    enabled,
  });
}

export function useMyFollowers(enabled = true) {
  return useQuery({
    queryKey: socialKeys.myFollowers,
    queryFn: () => socialApi.myFollowers(),
    enabled,
  });
}

export function useFollowStatus(userId: number) {
  return useQuery({
    queryKey: socialKeys.follow(userId),
    queryFn: () => socialApi.followStatus(userId),
  });
}

export function useToggleFollow(userId: number) {
  return useOptimisticToggle<FollowStatus>({
    queryKey: socialKeys.follow(userId),
    request: (next) => (next ? socialApi.follow(userId) : socialApi.unfollow(userId)),
    optimistic: (current, next) => ({
      ...current,
      following: next,
      followers_count: Math.max(0, current.followers_count + (next ? 1 : -1)),
    }),
    invalidate: [socialKeys.myFollowing],
  });
}
