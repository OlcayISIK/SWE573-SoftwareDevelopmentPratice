import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/context";
import type { CurrentUser } from "@/features/auth/types";

import { profilesApi } from "./api";

export const profileKeys = {
  detail: (userId: number) => ["profiles", userId] as const,
};

export function usePublicProfile(userId: number | null) {
  return useQuery({
    queryKey: profileKeys.detail(userId ?? 0),
    queryFn: () => profilesApi.publicProfile(userId as number),
    enabled: userId !== null,
  });
}

/** Profile changes update the signed-in user and any cached public view of them. */
export function useProfileMutation<T>(mutationFn: (input: T) => Promise<CurrentUser>) {
  const { setUser } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (user) => {
      setUser(user);
      return queryClient.invalidateQueries({ queryKey: profileKeys.detail(user.id) });
    },
  });
}
