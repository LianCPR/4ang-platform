/**
 * 4ang Shared Track Types
 */

export interface Track {
  id: string;
  title: string;
  artist_name: string;
  artist_username?: string;
  album?: string;
  genre?: string;
  duration_ms?: number;
  artwork_url?: string;
  status: "draft" | "pending_review" | "approved" | "rejected" | "archived";
  created_at: string;
  updated_at?: string;
}

export interface TrackWithMeta extends Track {
  coverUrl?: string;
  duration?: number;
  liked?: boolean;
  saved?: boolean;
}

export interface PlayEvent {
  track_id: string;
  username: string;
  played_at: string;
  duration_ms?: number;
  completed?: boolean;
}

export interface TrackLike {
  track_id: string;
  username: string;
  created_at: string;
}

export interface TrackSave {
  track_id: string;
  username: string;
  created_at: string;
}

export type TrackAction = "play" | "like" | "unlike" | "save" | "unsave" | "skip" | "replay";

export interface TrackFeedback {
  track_id: string;
  action: TrackAction;
  timestamp: string;
  context?: string;
}
