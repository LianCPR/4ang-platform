/**
 * 4ang Event Types — Shared
 */

export type EventType =
  | "track.played" | "track.completed" | "track.skipped" | "track.seeked"
  | "track.liked" | "track.unliked" | "track.saved" | "track.unsaved"
  | "playlist.created" | "playlist.updated" | "playlist.track_added" | "playlist.track_removed"
  | "artist.followed" | "artist.unfollowed"
  | "user.followed" | "user.unfollowed"
  | "post.created" | "post.liked" | "comment.created" | "comment.liked"
  | "search.executed"
  | "recommendation.impression" | "recommendation.clicked" | "recommendation.played"
  | "recommendation.skipped" | "recommendation.feedback"
  | "room.joined" | "room.left"
  | "assistant.message" | "assistant.tool_called"
  | "track.uploaded" | "track.analysis.completed";

export type EntityType =
  | "track" | "artist" | "album" | "playlist" | "post" | "comment"
  | "user" | "room" | "recommendation" | "search" | "assistant";

export interface AppEvent {
  id?: string;
  user_id: string;
  event_type: EventType;
  entity_type?: EntityType;
  entity_id?: string;
  session_id?: string;
  metadata?: Record<string, unknown>;
  occurred_at: string;
}

export interface EventBatch {
  events: Omit<AppEvent, "id" | "user_id">[];
}

export interface PlaybackEvent {
  event_type: "track.played" | "track.completed" | "track.skipped" | "track.seeked";
  track_id: string;
  artist_username?: string;
  position_ms?: number;
  duration_ms?: number;
}
