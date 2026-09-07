/**
 * 4ang Room Types
 */

export interface Room {
  id: string;
  name: string;
  host_username: string;
  description?: string;
  cover_url?: string;
  is_active: boolean;
  max_participants: number;
  created_at: string;
  updated_at: string;
}

export interface RoomParticipant {
  room_id: string;
  username: string;
  role: "host" | "moderator" | "listener";
  joined_at: string;
}

export interface RoomQueue {
  id: string;
  room_id: string;
  track_id: string;
  added_by: string;
  position: number;
  created_at: string;
}

export interface RoomPlayback {
  room_id: string;
  track_id: string;
  position_ms: number;
  is_playing: boolean;
  updated_at: string;
}
