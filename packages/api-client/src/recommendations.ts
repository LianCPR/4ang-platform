/**
 * 4ang Recommendations API
 */

import { request } from "./client";
import type { Track, RecommendationResponse, TasteProfile, DailyMix } from "@4ang/shared-types";

export const recommendationsApi = {
  /** Get personalized For You */
  forYou: (limit?: number, context?: string) => {
    const query = new URLSearchParams();
    if (limit) query.set("limit", String(limit));
    if (context) query.set("context", context);
    return request<RecommendationResponse>(`/recommendations/for-you?${query}`);
  },

  /** Get contextual recommendations */
  contextual: (context: string, limit?: number) => {
    const query = new URLSearchParams({ context });
    if (limit) query.set("limit", String(limit));
    return request<RecommendationResponse>(`/recommendations/contextual?${query}`);
  },

  /** Get daily mixes */
  dailyMix: () => request<{ mixes: DailyMix[] }>("/recommendations/daily-mix"),

  /** Get smart radio from seed */
  smartRadio: (trackId: string) =>
    request<{ tracks: Track[] }>(`/recommendations/smart-radio?trackId=${trackId}`),

  /** Get similar songs */
  similarSongs: (trackId: string, limit?: number) => {
    const query = new URLSearchParams({ trackId });
    if (limit) query.set("limit", String(limit));
    return request<{ tracks: Track[] }>(`/recommendations/similar-songs?${query}`);
  },

  /** Get similar artists */
  similarArtists: (limit?: number) => {
    const query = new URLSearchParams();
    if (limit) query.set("limit", String(limit));
    return request<{ artists: { artist_name: string; username: string; genre?: string }[] }>(
      `/recommendations/similar-artists?${query}`
    );
  },

  /** Get taste profile */
  tasteProfile: () => request<TasteProfile>("/recommendations/taste-profile"),

  /** Mark track as not interested */
  notInterested: (trackId: string) =>
    request<{ excluded: boolean }>("/recommendations/not-interested", {
      method: "POST",
      body: { trackId },
    }),

  /** Record feedback */
  feedback: (trackId: string, action: string) =>
    request<{ recorded: boolean }>("/recommendations/feedback", {
      method: "POST",
      body: { trackId, action },
    }),
};
