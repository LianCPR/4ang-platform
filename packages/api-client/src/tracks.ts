/**
 * 4ang Tracks API
 */

import { request } from "./client";
import type { Track } from "@4ang/shared-types";

export interface TracksListParams {
  limit?: number;
  offset?: number;
  status?: string;
  genre?: string;
}

export interface TracksSearchParams {
  q: string;
  limit?: number;
}

export const tracksApi = {
  /** List tracks */
  list: (params?: TracksListParams) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    if (params?.status) query.set("status", params.status);
    if (params?.genre) query.set("genre", params.genre);
    return request<Track[]>(`/tracks?${query}`);
  },

  /** Get track by ID */
  getById: (id: string) => request<Track>(`/tracks/${id}`),

  /** Search tracks */
  search: (params: TracksSearchParams) => {
    const query = new URLSearchParams({ q: params.q });
    if (params.limit) query.set("limit", String(params.limit));
    return request<Track[]>(`/tracks?${query}`);
  },

  /** Get public tracks for discover */
  public: (params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    return request<Track[]>(`/tracks/public?${query}`);
  },
};
