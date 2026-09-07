/**
 * 4ang Shared User Types
 */

export interface UserProfile {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  role: "user" | "artist" | "admin";
  is_restricted?: boolean;
  follower_count?: number;
  following_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface UserSummary {
  username: string;
  display_name?: string;
  avatar_url?: string;
  role: string;
  verified?: boolean;
}

export interface UserFollow {
  follower_username: string;
  following_username: string;
  created_at: string;
}

export interface Session {
  username: string;
  displayName?: string;
  email?: string;
  role: string;
  avatarUrl?: string;
}
