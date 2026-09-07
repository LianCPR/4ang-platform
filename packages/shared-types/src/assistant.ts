/**
 * 4ang AI Assistant Types
 */

import type { Track } from "./track";
import type { ArtistProfile } from "./artist";
import type { Playlist, DailyMix } from "./playlist";

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: {
    intent?: string;
    trackCount?: number;
    actions?: string[];
    [key: string]: unknown;
  };
  created_at: string;
}

export interface AssistantConversation {
  id: string;
  username: string;
  title: string | null;
  created_at: string;
  updated_at: string;
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
    tracks: Track[];
    artists: ArtistProfile[];
    playlists: Playlist[];
    dailyMixes: DailyMix[];
    recentlyPlayed: Track[];
    likedSongs: Track[];
    followedArtists: ArtistProfile[];
  };
  actions: AssistantAction[];
  latency: number;
}

export interface AssistantAction {
  type: "play_all" | "add_to_queue" | "playlist_draft" | "not_interested" | "play";
  tracks?: Track[];
  trackId?: string;
  draft?: PlaylistDraft;
  startIndex?: number;
}

export interface PlaylistDraft {
  title: string;
  description: string;
  tracks: Track[];
  _type: "playlist_draft";
  _status: "draft";
}

export interface AssistantToolCall {
  tool: string;
  args: Record<string, unknown>;
}

export interface AssistantToolResult {
  tool: string;
  result: unknown;
  error?: string;
}
