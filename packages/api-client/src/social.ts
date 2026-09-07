/**
 * 4ang Social API
 */

import { request } from "./client";
import type { ActivityEvent, UserFollowResult } from "@4ang/shared-types";

export interface SocialFeedParams {
  limit?: number;
  offset?: number;
}

export const socialApi = {
  /** Get activity feed */
  feed: (params?: SocialFeedParams) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    return request<ActivityEvent[]>(`/social/feed?${query}`);
  },

  /** Follow a user */
  follow: (username: string) =>
    request<UserFollowResult>(`/social/follow/${username}`, { method: "POST" }),

  /** Unfollow a user */
  unfollow: (username: string) =>
    request<UserFollowResult>(`/social/follow/${username}`, { method: "DELETE" }),

  /** Check if following */
  checkFollow: (username: string) =>
    request<{ following: boolean }>(`/social/follow/check`, {
      method: "POST",
      body: { username },
    }),

  /** Get followers */
  followers: (username: string) =>
    request<{ followers: { username: string; display_name?: string; avatar_url?: string }[] }>(
      `/social/followers/${username}`
    ),

  /** Get following */
  following: (username: string) =>
    request<{ following: { username: string; display_name?: string; avatar_url?: string }[] }>(
      `/social/following/${username}`
    ),

  /** Search people */
  people: (query: string) =>
    request<{ users: { username: string; display_name?: string; avatar_url?: string }[] }>(
      `/social/people?q=${encodeURIComponent(query)}`
    ),

  /** Record share activity */
  share: (targetType: string, targetId: string) =>
    request<{ shared: boolean }>("/social/share", {
      method: "POST",
      body: { targetType, targetId },
    }),
};
