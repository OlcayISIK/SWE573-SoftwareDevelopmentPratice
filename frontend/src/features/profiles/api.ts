import { api } from "@/api/client";
import type { Schemas } from "@/api/types";
import type { CurrentUser } from "@/features/auth/types";

export type PublicProfile = Schemas["PublicProfile"];

export interface ProfileChanges {
  display_name?: string;
  bio?: string;
  city?: string;
  country?: string;
  show_email?: boolean;
}

export const profilesApi = {
  publicProfile: (userId: number) => api.get<PublicProfile>(`/users/${userId}/`),
  updateMe: (changes: ProfileChanges) => api.patch<CurrentUser>("/me/", changes),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("avatar", file);
    return api.patch<CurrentUser>("/me/", form);
  },
  removeAvatar: () => api.patch<CurrentUser>("/me/", { avatar: null }),
};
