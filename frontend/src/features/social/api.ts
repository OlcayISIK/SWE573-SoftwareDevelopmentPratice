import { api } from "@/api/client";
import type { Paginated, Schemas } from "@/api/types";
import type { CraftListItem } from "@/features/crafts/types";

export type FavoriteStatus = Schemas["FavoriteStatus"];
export type FollowStatus = Schemas["FollowStatus"];
export type FollowEntry = Schemas["FollowingEntry"];

export const socialApi = {
  favoriteStatus: (craftId: number) => api.get<FavoriteStatus>(`/crafts/${craftId}/favorite/`),
  favorite: (craftId: number) => api.post<FavoriteStatus>(`/crafts/${craftId}/favorite/`),
  unfavorite: (craftId: number) => api.delete(`/crafts/${craftId}/favorite/`),
  myFavorites: (page: number) =>
    api.get<Paginated<CraftListItem>>("/me/favorites/", { params: { page } }),
  myFollowing: (page = 1) =>
    api.get<Paginated<FollowEntry>>("/me/following/", { params: { page } }),
  myFollowers: (page = 1) =>
    api.get<Paginated<FollowEntry>>("/me/followers/", { params: { page } }),
  followStatus: (userId: number) => api.get<FollowStatus>(`/users/${userId}/follow/`),
  follow: (userId: number) => api.post<FollowStatus>(`/users/${userId}/follow/`),
  unfollow: (userId: number) => api.delete(`/users/${userId}/follow/`),
};
