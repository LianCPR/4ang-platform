/**
 * 4ang Shared Social Types
 */

export type ActivityType =
  | "song_liked"
  | "song_shared"
  | "playlist_created"
  | "artist_followed"
  | "user_followed"
  | "song_released"
  | "album_released"
  | "new_release"
  | "comment_created"
  | "post_liked";

export interface ActivityEvent {
  id: string;
  username: string;
  event_type: ActivityType;
  target_type?: string;
  target_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface SocialPost {
  id: string;
  username: string;
  content?: string;
  activity_type: ActivityType;
  target_type?: string;
  target_id?: string;
  like_count: number;
  comment_count: number;
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  username: string;
  content: string;
  parent_id?: string;
  like_count: number;
  reply_count: number;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  username: string;
  type: string;
  title: string;
  body?: string;
  actor_username?: string;
  target_type?: string;
  target_id?: string;
  is_read: boolean;
  created_at: string;
}

export interface UserFollowResult {
  following: boolean;
  follower_count: number;
  following_count: number;
}
