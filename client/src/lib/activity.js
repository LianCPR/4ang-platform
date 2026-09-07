import {
  Heart, Share2, Music, ListMusic, UserPlus, Sparkles, Users, MessageCircle, Radio,
  Bell, Disc3, CheckCircle, XCircle, AlertTriangle, Shield, AtSign,
} from "lucide-react";

// Shared activity/notification type config for feed items, post detail,
// notification bubbles. Single source so icons/verbs stay consistent.
export const ACTIVITY_CONFIG = {
  SONG_LIKED: { icon: Heart, color: "var(--c-rose)", verb: "đã thích" },
  SONG_SHARED: { icon: Share2, color: "var(--c-sage)", verb: "đã chia sẻ" },
  SHARED: { icon: Share2, color: "var(--c-sage)", verb: "đã chia sẻ" },
  PLAYLIST_CREATED: { icon: ListMusic, color: "var(--c-gold)", verb: "đã tạo playlist" },
  ARTIST_FOLLOWED: { icon: UserPlus, color: "var(--c-sage-deep)", verb: "đã theo dõi" },
  USER_FOLLOWED: { icon: UserPlus, color: "var(--c-sage-deep)", verb: "đã theo dõi" },
  NEW_RELEASE: { icon: Music, color: "var(--c-sage)", verb: "đã phát hành" },
  TRACK_PUBLISHED: { icon: Music, color: "var(--c-sage)", verb: "đã phát hành" },
  ARTIST_APPROVED: { icon: Sparkles, color: "var(--c-gold)", verb: "đã được xác minh" },
  ROOM_STARTED: { icon: Radio, color: "var(--c-sage)", verb: "đã mở phòng nghe nhạc" },
  ARTIST_POSTED: { icon: Music, color: "var(--c-sage-deep)", verb: "đã đăng" },
};

// Notification badge config (notification list).
export const NOTIFICATION_CONFIG = {
  NEW_RELEASE: { icon: Disc3, color: "var(--c-sage-deep)", label: "Phát hành mới" },
  TRACK_PUBLISHED: { icon: CheckCircle, color: "var(--success)", label: "Đã xuất bản" },
  ARTIST_FOLLOWED: { icon: Users, color: "var(--c-gold)", label: "Người theo dõi" },
  ARTIST_APPROVED: { icon: Sparkles, color: "var(--c-sage-deep)", label: "Nghệ sĩ" },
  ARTIST_REJECTED: { icon: AlertTriangle, color: "var(--danger)", label: "Yêu cầu" },
  ARTIST_VERIFIED: { icon: Shield, color: "var(--c-sage-deep)", label: "Xác minh" },
  ARTIST_VERIFICATION_REJECTED: { icon: AlertTriangle, color: "var(--danger)", label: "Xác minh" },
  SUBMISSION_APPROVED: { icon: CheckCircle, color: "var(--success)", label: "Đã duyệt" },
  SUBMISSION_REJECTED: { icon: XCircle, color: "var(--danger)", label: "Bị từ chối" },
  SUBMISSION_PUBLISHED: { icon: Music, color: "var(--c-sage-deep)", label: "Đã phát hành" },
  SUPPORT_TICKET_UPDATE: { icon: MessageCircle, color: "var(--c-gold)", label: "Hỗ trợ" },
  NEW_COMMENT: { icon: MessageCircle, color: "var(--c-sage)", label: "Bình luận" },
  COMMENT_REPLY: { icon: MessageCircle, color: "var(--c-sage-deep)", label: "Trả lời bình luận" },
  MENTION: { icon: AtSign, color: "var(--c-gold)", label: "Được nhắc đến" },
  COMMENT_LIKED: { icon: Heart, color: "var(--c-rose)", label: "Tym bình luận" },
  POST_LIKED: { icon: Heart, color: "var(--c-rose)", label: "Yêu thích bài đăng" },
  ARTIST_POSTED: { icon: Disc3, color: "var(--c-sage-deep)", label: "Bài đăng nghệ sĩ" },
  ROOM_INVITE: { icon: Radio, color: "var(--c-sage-deep)", label: "Mời nghe cùng" },
  SYSTEM: { icon: Bell, color: "var(--text-muted)", label: "Hệ thống" },
};