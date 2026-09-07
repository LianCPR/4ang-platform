/**
 * 4ang Shared Playlist Types
 */

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  owner_username: string;
  cover_url?: string;
  track_count: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlaylistTrack {
  playlist_id: string;
  track_id: string;
  position: number;
  added_at: string;
}

export interface PlaylistWithTracks extends Playlist {
  tracks?: PlaylistTrack[];
}

export interface DailyMix {
  id: string;
  title: string;
  description: string;
  theme: string;
  tracks: import("./track").Track[];
}
