/**
 * 4ang AI Intelligence Types
 */

export type MoodType = "calm" | "happy" | "sad" | "melancholic" | "energetic" | "romantic" | "dreamy" | "dark" | "hopeful" | "nostalgic";

export type EnergyLevel = "very_low" | "low" | "medium" | "high" | "very_high";

export type ContextTag = "study" | "focus" | "sleep" | "workout" | "travel" | "party" | "relax" | "night" | "morning" | "commute";

export interface TrackAnalysis {
  mood: MoodType[];
  energy: EnergyLevel;
  contexts: ContextTag[];
  themes: string[];
  genres: string[];
  confidence: number;
}

export interface MusicIntent {
  intent: string;
  query?: string;
  artistName?: string;
  trackName?: string;
  mood?: MoodType[];
  energy?: EnergyLevel;
  activity?: string;
  durationMinutes?: number;
  playlistAction?: "create" | "modify" | null;
  currentTrackRef?: boolean;
  excludeArtists?: string[];
  confidence: number;
}

export interface PlaylistPlan {
  title: string;
  description: string;
  mood: MoodType[];
  energy: EnergyLevel;
  genres: string[];
  contexts: ContextTag[];
  duration_minutes: number | null;
  track_count: number;
  exclude_artists: string[];
  language: string;
  variety: "low" | "medium" | "high";
}

export interface AiStatus {
  configured: boolean;
  provider: string;
  model: string;
  cacheSize: number;
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
}
