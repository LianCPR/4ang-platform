/**
 * 4ang Audio Analysis Types
 *
 * Shared types for C++ audio engine results.
 * Used by TypeScript API and Python intelligence service.
 */

export interface WaveformPoint {
  min_amplitude: number;
  max_amplitude: number;
  rms: number;
}

export interface WaveformData {
  points: WaveformPoint[];
  num_points: number;
  duration_seconds: number;
  sample_rate: number;
}

export interface LoudnessAnalysis {
  integrated_lufs: number;
  true_peak_dbtp: number;
  short_term_lufs: number;
  dynamic_range_db: number;
  silence_ratio: number;
}

export interface SpectralAnalysis {
  centroid: number;
  bandwidth: number;
  rolloff: number;
  flatness: number;
  flux: number;
  brightness: number;
}

export interface TempoAnalysis {
  bpm: number;
  confidence: number;
  tempo_stability: number;
}

export interface BeatAnalysis {
  beat_times: number[];
  beat_strengths: number[];
  num_beats: number;
}

export interface AudioFeatures {
  rms: number;
  peak: number;
  dynamic_range_db: number;
  energy: number;
  danceability: number;
  acousticness: number;
  instrumentalness: number;
  zero_crossing_rate: number;
}

export interface SilenceRegion {
  start_seconds: number;
  end_seconds: number;
  duration_seconds: number;
}

export interface AudioAnalysis {
  status: "completed" | "error";
  engine_version: string;
  analysis_schema_version: number;
  duration: number;
  sample_rate: number;
  channels: number;
  loudness: LoudnessAnalysis;
  tempo: TempoAnalysis;
  spectral: SpectralAnalysis;
  features: AudioFeatures;
  waveform: { num_points: number };
  beats: { num_beats: number };
  silence_regions: SilenceRegion[];
}

export interface AnalysisJob {
  id: string;
  track_id: string;
  status: "pending" | "processing" | "completed" | "error";
  result?: AudioAnalysis;
  error?: string;
  created_at: string;
  completed_at?: string;
}
