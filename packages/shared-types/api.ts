/**
 * 4ang Shared API Types
 */

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface SearchResponse<T> {
  results: T[];
  total: number;
  query: string;
}

export interface RecommendationResult {
  tracks: import("./track").Track[];
  reasons: string[];
  metadata: {
    strategy: string;
    context?: string;
    personalization_level?: string;
    [key: string]: unknown;
  };
}

export interface DailyMixResult {
  mixes: import("./playlist").DailyMix[];
}

export interface SmartRadioResult {
  tracks: import("./track").Track[];
  seed_track?: import("./track").Track;
}

export interface TasteProfile {
  top_artists: { name: string; score: number }[];
  top_genres: { genre: string; score: number }[];
  recent_likes: import("./track").Track[];
  listening_stats: {
    total_plays: number;
    unique_artists: number;
    unique_genres: number;
    personalization_level: string;
  };
}

export interface AiStatus {
  configured: boolean;
  provider: string;
  model: string;
  cacheSize: number;
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
}

export interface AssistantResponse {
  conversationId: string;
  response: {
    text: string;
    actions: string[];
  };
  intent: {
    intent: string;
    confidence: number;
    [key: string]: unknown;
  };
  toolResults: {
    tracks: import("./track").Track[];
    artists: import("./artist").ArtistProfile[];
    playlists: import("./playlist").Playlist[];
    dailyMixes: import("./playlist").DailyMix[];
    recentlyPlayed: import("./track").Track[];
    likedSongs: import("./track").Track[];
    followedArtists: import("./artist").ArtistProfile[];
  };
  actions: { type: string; [key: string]: unknown }[];
  latency: number;
}
