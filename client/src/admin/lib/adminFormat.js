// lib/format.js's formatDate() expects a "YYYY-MM-DD" string (release
// dates); several admin views need to render raw ms timestamps
// (created_at, restricted_at, ...) instead, hence this tiny sibling.
export function formatTimestamp(ms) {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
