/**
 * 4ang Event System Types
 *
 * Typed event model for application events.
 * Events flow from application → PostgreSQL → future event bus.
 */

// ═══════════════════════════════════════════════════════════════════
// EVENT TYPES
// ═══════════════════════════════════════════════════════════════════

export type EventType =
  // Playback
  | "track.played"
  | "track.completed"
  | "track.skipped"
  | "track.seeked"
  // Library
  | "track.liked"
  | "track.unliked"
  | "track.saved"
  | "track.unsaved"
  // Playlist
  | "playlist.created"
  | "playlist.updated"
  | "playlist.track_added"
  | "playlist.track_removed"
  // Artist
  | "artist.followed"
  | "artist.unfollowed"
  | "artist.release.published"
  // Social
  | "user.followed"
  | "user.unfollowed"
  | "post.created"
  | "post.liked"
  | "comment.created"
  | "comment.liked"
  // Search
  | "search.executed"
  // Recommendation
  | "recommendation.impression"
  | "recommendation.clicked"
  | "recommendation.played"
  | "recommendation.skipped"
  | "recommendation.feedback"
  // Room
  | "room.joined"
  | "room.left"
  | "room.playback.changed"
  // AI
  | "assistant.message"
  | "assistant.tool_called"
  // Upload
  | "track.uploaded"
  | "track.analysis.completed";

export type EntityType =
  | "track"
  | "artist"
  | "album"
  | "playlist"
  | "post"
  | "comment"
  | "user"
  | "room"
  | "recommendation"
  | "search"
  | "assistant";

// ═══════════════════════════════════════════════════════════════════
// EVENT STRUCTURE
// ═══════════════════════════════════════════════════════════════════

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
  events: AppEvent[];
}

// ═══════════════════════════════════════════════════════════════════
// PLAYBACK EVENTS
// ═══════════════════════════════════════════════════════════════════

export interface PlaybackEvent {
  event_type: "track.played" | "track.completed" | "track.skipped" | "track.seeked";
  track_id: string;
  artist_username?: string;
  position_ms?: number;
  duration_ms?: number;
  completed?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// EVENT SERVICE INTERFACE
// ═══════════════════════════════════════════════════════════════════

export interface EventService {
  /** Record a single event */
  record(event: AppEvent): Promise<void>;

  /** Record a batch of events */
  recordBatch(events: AppEvent[]): Promise<void>;

  /** Get events for a user */
  getUserEvents(userId: string, limit?: number): Promise<AppEvent[]>;

  /** Get event counts by type */
  getEventCounts(userId: string, since?: string): Promise<Record<string, number>>;
}
