/**
 * 4ang Player Types
 */

import type { Track } from "./track";

export type RepeatMode = "off" | "all" | "one";
export type ShuffleMode = "off" | "on";

export interface QueueItem {
  track: Track;
  added_at: string;
  added_by?: string;
}

export interface PlaybackState {
  current: Track | null;
  queue: QueueItem[];
  queueIndex: number;
  isPlaying: boolean;
  progress: number;
  volume: number;
  repeat: RepeatMode;
  shuffle: ShuffleMode;
}

export interface PlayerActions {
  playTrack: (track: Track, queue?: Track[], index?: number) => void;
  playAll: (tracks: Track[], index?: number) => void;
  togglePlayPause: () => void;
  handleNext: () => void;
  handlePrev: () => void;
  handleSeek: (time: number) => void;
  setVolume: (volume: number) => void;
  setRepeat: (mode: RepeatMode) => void;
  toggleShuffle: () => void;
  addToQueue: (tracks: Track[]) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  playNext: (tracks: Track[]) => void;
}

export interface LyricsLine {
  time: number;
  text: string;
}

export interface PlaybackError {
  code: string;
  message: string;
  track?: Track;
}
