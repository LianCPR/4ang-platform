const TONE_MAP = {
  verified: "accent", pending: "warning", rejected: "danger", independent: "success",
  approved: "success", published: "success", open: "warning", resolved: "success", dismissed: "default",
  restricted: "danger", active: "success", unpublished: "danger",
  pending_review: "warning", under_review: "accent", changes_requested: "warning", draft: "default",
};

const LABEL_MAP = {
  verified: "Đã xác minh", pending: "Đang chờ", rejected: "Đã từ chối", independent: "Độc lập",
  approved: "Đã duyệt", published: "Đã phát hành", open: "Đang mở", resolved: "Đã xử lý", dismissed: "Đã bỏ qua",
  restricted: "Bị hạn chế", active: "Hoạt động", unpublished: "Đã gỡ",
  pending_review: "Chờ duyệt", under_review: "Đang xem xét", changes_requested: "Yêu cầu sửa", draft: "Bản nháp",
};

export default function Pill({ status, children, tone }) {
  const resolvedTone = tone || TONE_MAP[status] || "default";
  return (
    <span className={"admin-pill" + (resolvedTone !== "default" ? " tone-" + resolvedTone : "")}>
      {children || LABEL_MAP[status] || status}
    </span>
  );
}
