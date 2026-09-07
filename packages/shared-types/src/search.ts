/**
 * 4ang Search Types
 */

import type { Track } from "./track";
import type { ArtistProfile } from "./artist";
import type { Playlist } from "./playlist";
import type { UserProfile } from "./user";

export type SearchTab = "all" | "tracks" | "artists" | "albums" | "playlists" | "people";

export interface SearchResult {
  tracks: Track[];
  artists: ArtistProfile[];
  playlists: Playlist[];
  people: UserProfile[];
  total: number;
  query: string;
}

export interface SearchFilters {
  tab: SearchTab;
  genre?: string;
  mood?: string;
  duration?: { min: number; max: number };
}
