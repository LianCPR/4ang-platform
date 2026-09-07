/**
 * 4ang Client Types — Comprehensive type definitions
 *
 * Maps existing JavaScript data structures to TypeScript.
 * This file bridges the gap between the current codebase and
 * the shared-types package.
 */

// ═══════════════════════════════════════════════════════════════════
// RE-EXPORT SHARED TYPES
// ═══════════════════════════════════════════════════════════════════

export type {
  Track,
  TrackWithMeta,
  ArtistProfile,
  ArtistLink,
  ArtistRelease,
  ArtistStats,
  Playlist,
  PlaylistTrack,
  PlaylistWithTracks,
  UserProfile,
  UserSummary,
  Session,
  ActivityEvent,
  SocialPost,
  Comment,
  Notification,
  Room,
  RoomParticipant,
  RoomQueue,
  RoomPlayback,
  QueueItem,
  RepeatMode,
  ShuffleMode,
  PlaybackState,
  PlayerActions,
  LyricsLine,
  PlaybackError,
  RecommendationResponse,
  TasteProfile,
  DailyMix,
  SmartRadioResponse,
  TrackAnalysis,
  MusicIntent,
  PlaylistPlan,
  AiStatus,
  AssistantMessage,
  AssistantConversation,
  AssistantResponse,
  AssistantAction,
  PlaylistDraft,
  SearchTab,
  SearchResult,
  ApiError,
} from "@4ang/shared-types";

// ═══════════════════════════════════════════════════════════════════
// LEGACY COMPATIBILITY TYPES
// ═══════════════════════════════════════════════════════════════════

/** Legacy track shape used by some components */
export interface LegacyTrack {
  id: string;
  title: string;
  artist_name: string;
  artist_username?: string;
  album?: string;
  genre?: string;
  duration_ms?: number;
  duration?: number;
  artwork_url?: string;
  coverUrl?: string;
  status?: string;
  liked?: boolean;
  saved?: boolean;
  [key: string]: unknown;
}

/** Legacy artist shape */
export interface LegacyArtist {
  id: string;
  username: string;
  artist_name: string;
  bio?: string;
  avatar_url?: string;
  cover_url?: string;
  genre?: string;
  verified?: boolean;
  follower_count?: number;
  links?: { label: string; url: string }[];
  [key: string]: unknown;
}

/** Legacy playlist shape */
export interface LegacyPlaylist {
  id: string;
  name: string;
  description?: string;
  owner_username: string;
  cover_url?: string;
  track_count: number;
  is_public: boolean;
  tracks?: unknown[];
  [key: string]: unknown;
}

/** Legacy user profile shape */
export interface LegacyProfile {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  role: string;
  is_restricted?: boolean;
  [key: string]: unknown;
}

/** Legacy notification shape */
export interface LegacyNotification {
  id: string;
  type: string;
  title: string;
  body?: string;
  actor_username?: string;
  target_type?: string;
  target_id?: string;
  is_read: boolean;
  created_at: string;
  [key: string]: unknown;
}

/** Legacy submission shape */
export interface LegacySubmission {
  id: string;
  title: string;
  artist_name: string;
  status: string;
  submitted_at: string;
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENT PROP TYPES
// ═══════════════════════════════════════════════════════════════════

/** Props for pages that use the player */
export interface PlayerPageProps {
  session: Session | null;
  current: Track | null;
  isPlaying: boolean;
  progress: number;
  onPlay: (tracks: Track[], index?: number) => void;
  onLike?: (track: Track) => void;
  onSave?: (track: Track) => void;
  onShare?: (track: Track) => void;
  onComment?: (trackId: string) => void;
  onLyrics?: (trackId: string) => void;
  onAddToPlaylist?: (trackId: string) => void;
  onOpenArtist?: (username: string) => void;
  onOpenGenre?: (genre: string) => void;
  onOpenPlaylist?: (playlistId: string) => void;
  onOpenRoom?: (roomId: string) => void;
  onOpenPost?: (postId: string) => void;
  showToast?: (message: string, type?: string) => void;
}

/** Props for components with queue actions */
export interface QueueActions {
  onPlayNext?: (tracks: Track[]) => void;
  onAddToQueue?: (tracks: Track[]) => void;
  onAddToPlaylist?: (trackId: string) => void;
}

// ═══════════════════════════════════════════════════════════════════
// API RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════════

/** Generic API response wrapper */
export interface ApiResult<T> {
  data?: T;
  error?: string;
  message?: string;
}

/** Paginated API response */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTING HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Duration formatting */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

/** Time ago formatting */
export function formatTimeAgo(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return "vừa xong";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} ngày trước`;
  return then.toLocaleDateString("vi-VN");
}

/** Generate gradient from hue */
export function gradientFor(hue: number): string {
  return `linear-gradient(135deg, hsl(${hue}, 60%, 30%), hsl(${(hue + 40) % 360}, 50%, 25%))`;
}

/** Generate hue from string */
export function hashHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 360);
}
