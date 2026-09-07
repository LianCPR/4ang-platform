/**
 * 4ang Shared Artist Types
 */

export interface ArtistProfile {
  id: string;
  username: string;
  artist_name: string;
  bio?: string;
  avatar_url?: string;
  cover_url?: string;
  genre?: string;
  verified?: boolean;
  follower_count?: number;
  links?: ArtistLink[];
  created_at: string;
  updated_at?: string;
}

export interface ArtistLink {
  label: string;
  url: string;
}

export interface ArtistFollow {
  username: string;
  artist_username: string;
  created_at: string;
}

export interface ArtistRelease {
  id: string;
  artist_username: string;
  title: string;
  type: "single" | "album" | "ep";
  status: "draft" | "pending_review" | "approved" | "rejected";
  description?: string;
  cover_url?: string;
  track_count?: number;
  created_at: string;
  published_at?: string;
}

export interface ArtistStats {
  total_plays: number;
  total_likes: number;
  total_followers: number;
  monthly_listeners: number;
  daily_plays: { date: string; count: number }[];
  track_play_history: { track_id: string; title: string; plays: number }[];
}
