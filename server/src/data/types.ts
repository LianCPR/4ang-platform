/**
 * 4ang Data Platform Types
 *
 * Domain model types for the data layer.
 */

// ═══════════════════════════════════════════════════════════════════
// AUDIO ANALYSIS
// ═══════════════════════════════════════════════════════════════════

export interface AudioAnalysis {
  id: string;
  track_id: string;
  duration_seconds: number;
  sample_rate: number;
  channels: number;
  loudness_lufs: number;
  true_peak_dbtp: number;
  dynamic_range_db: number;
  rms: number;
  peak: number;
  bpm: number;
  bpm_confidence: number;
  spectral_centroid: number;
  spectral_bandwidth: number;
  spectral_rolloff: number;
  spectral_flatness: number;
  brightness: number;
  energy: number;
  silence_ratio: number;
  waveform_points: number;
  analysis_version: string;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════
// TASTE PROFILE
// ═══════════════════════════════════════════════════════════════════

export interface TasteProfile {
  user_id: string;
  top_artists: { username: string; name: string; score: number }[];
  top_genres: { genre: string; score: number }[];
  top_tracks: { track_id: string; title: string; score: number }[];
  listening_frequency: "rare" | "occasional" | "regular" | "daily" | "heavy";
  personalization_level: "cold_start" | "early" | "moderate" | "strong";
  last_updated: string;
}

// ═══════════════════════════════════════════════════════════════════
// AI JOB
// ═══════════════════════════════════════════════════════════════════

export type AIJobType =
  | "audio_analysis"
  | "waveform_generation"
  | "feature_extraction"
  | "recommendation_refresh"
  | "taste_profile_update"
  | "embedding_generation";

export type AIJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface AIJob {
  id: string;
  job_type: AIJobType;
  status: AIJobStatus;
  target_type: string;
  target_id: string;
  result?: unknown;
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

// ═══════════════════════════════════════════════════════════════════
// EMBEDDING
// ═══════════════════════════════════════════════════════════════════

export interface Embedding {
  id: string;
  entity_type: "track" | "artist" | "album" | "playlist";
  entity_id: string;
  model: string;
  version: string;
  vector: number[];
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════
// RECOMMENDATION
// ═══════════════════════════════════════════════════════════════════

export interface RecommendationResult {
  id: string;
  user_id: string;
  context: string;
  track_id: string;
  score: number;
  reason: string;
  source: string;
  position: number;
  created_at: string;
  impression_at?: string;
  clicked_at?: string;
  played_at?: string;
  skipped_at?: string;
}

export interface RecommendationFeedback {
  recommendation_id: string;
  event_type: "impression" | "click" | "play" | "skip" | "like" | "save" | "hide";
  metadata?: Record<string, unknown>;
}
