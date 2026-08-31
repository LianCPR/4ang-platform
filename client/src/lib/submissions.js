// Mirrors CREDIT_ROLES / TERMS_VERSION in server/src/routes/submissions.js —
// keep the `value`s in sync with the server; only the labels are
// display-only and safe to change freely.
export const CREDIT_ROLES = [
  { value: "featured", label: "Nghệ sĩ khách mời" },
  { value: "producer", label: "Nhà sản xuất" },
  { value: "composer", label: "Sáng tác" },
  { value: "lyricist", label: "Viết lời" },
  { value: "remixer", label: "Phối lại (Remix)" },
  { value: "dj", label: "DJ" },
  { value: "vocalist", label: "Hát / Vocal" },
  { value: "other", label: "Khác" },
];

export function creditRoleLabel(role) {
  if (role === "main") return "Nghệ sĩ chính";
  const found = CREDIT_ROLES.find((r) => r.value === role);
  return found ? found.label : role;
}

export const TERMS_VERSION = "2026-08";

export const LANGUAGES = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "Tiếng Anh" },
  { value: "other", label: "Ngôn ngữ khác" },
];

// tone drives the status-badge color class only — every status also always
// renders its text label, never color alone (§64/§77).
const SUBMISSION_STATUSES = {
  draft: { label: "Bản nháp", tone: "neutral" },
  pending_review: { label: "Đang chờ duyệt", tone: "pending" },
  under_review: { label: "Đang được xem xét", tone: "pending" },
  changes_requested: { label: "Cần chỉnh sửa", tone: "warning" },
  approved: { label: "Đã duyệt · chờ phát hành", tone: "success" },
  rejected: { label: "Bị từ chối", tone: "danger" },
  published: { label: "Đã phát hành", tone: "success" },
};

export function submissionStatusLabel(status) {
  return (SUBMISSION_STATUSES[status] && SUBMISSION_STATUSES[status].label) || status;
}
export function submissionStatusTone(status) {
  return (SUBMISSION_STATUSES[status] && SUBMISSION_STATUSES[status].tone) || "neutral";
}

export const SUBMISSION_EVENT_LABELS = {
  submitted: "Đã gửi yêu cầu",
  resubmitted: "Đã gửi lại sau khi chỉnh sửa",
  review_started: "4ANG bắt đầu xem xét",
  changes_requested: "4ANG yêu cầu chỉnh sửa",
  approved: "4ANG đã duyệt",
  rejected: "4ANG đã từ chối",
  published: "Bài hát đã được phát hành",
};

// Platform rules shown before final submission (§24) — plain-language
// house rules, not a legal Terms of Service document.
export const SUBMISSION_RULES = [
  "Chỉ gửi nội dung mà bạn thực sự có quyền gửi.",
  "Không gửi nội dung vi phạm pháp luật.",
  "Không mạo danh nghệ sĩ khác hoặc khai thông tin sai lệch.",
  "Không gửi bài hát trùng lặp hoặc mang tính spam.",
  "Không gửi nhạc vi phạm bản quyền của người khác.",
  "Không tải lên file độc hại dưới bất kỳ hình thức nào.",
  "Tôn trọng những nghệ sĩ khác được credit trong bài hát của bạn.",
  "4ANG có quyền từ chối bất kỳ yêu cầu nào không phù hợp.",
  "Được duyệt không đồng nghĩa với việc bài hát được giữ vĩnh viễn trên 4ANG.",
  "4ANG có thể gỡ bỏ nội dung vi phạm quy định nền tảng vào bất kỳ lúc nào.",
];
