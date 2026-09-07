/**
 * 4ang Discovery API
 */

import { request } from "./client";
import type { Track, ArtistProfile, RecommendationResponse, DailyMix } from "@4ang/shared-types";

export const discoveryApi = {
  /** Get trending tracks */
  trending: (limit?: number) =>
    request<Track[]>(`/discover/trending${limit ? `?limit=${limit}` : ""}`),

  /** Get new releases */
  newReleases: (limit?: number) =>
    request<Track[]>(`/discover/new-releases${limit ? `?limit=${limit}` : ""}`),

  /** Get radio from seed */
  radio: (seedId: string) =>
    request<Track[]>(`/discover/radio?seed=${seedId}`),

  /** Get more like this */
  moreLikeThis: (trackId: string) =>
    request<Track[]>(`/discover/more-like-this?trackId=${trackId}`),

  /** Get because you listened */
  becauseYouListened: (artistUsername: string) =>
    request<Track[]>(`/discover/because-you-listened?artist=${artistUsername}`),

  /** Get social discovery */
  social: () => request<{ users: ArtistProfile[]; tracks: Track[] }>("/discover/social"),

  /** Get recommendations */
  recommendations: (limit?: number) =>
    request<Track[]>(`/discover/recommendations?limit=${limit || 12}`),

  /** Get genres */
  genres: () => request<{ name: string; count: number }[]>("/discover/genres"),
};
