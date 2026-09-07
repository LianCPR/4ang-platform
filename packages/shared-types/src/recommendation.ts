/**
 * 4ang Recommendation Types
 */

import type { Track } from "./track";
import type { ArtistProfile } from "./artist";

export type RecommendationContext = "home" | "discover" | "radio" | "similar" | "artist" | "social";

export interface RecommendationReason {
  type: string;
  description: string;
  weight: number;
}

export interface Recommendation {
  track: Track;
  reasons: RecommendationReason[];
  score: number;
  context: RecommendationContext;
}

export interface RecommendationResponse {
  tracks: (Track & { _reason?: string })[];
  reasons: string[];
  metadata: {
    strategy: string;
    context?: string;
    personalization_level?: string;
    [key: string]: unknown;
  };
}

export interface TasteProfile {
  top_artists: { name: string; score: number }[];
  top_genres: { genre: string; score: number }[];
  recent_likes: Track[];
  listening_stats: {
    total_plays: number;
    unique_artists: number;
    unique_genres: number;
    personalization_level: string;
  };
}

export interface DailyMix {
  id: string;
  title: string;
  description: string;
  theme: string;
  tracks: Track[];
}

export interface SmartRadioResponse {
  tracks: Track[];
  seed_track?: Track;
}
