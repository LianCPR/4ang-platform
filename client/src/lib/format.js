// Curated duotone pairs in the 4ANG warm palette — used instead of a random hue
// wheel so every piece of placeholder artwork still feels like it belongs
// to the same garden collection. Warm, natural, floral tones.
const PLACEHOLDER_PALETTES = [
  ["#9AA68A", "#6F8066"],  // sage
  ["#D9A3A0", "#B8858A"],  // blush rose
  ["#D8B46A", "#C9A76B"],  // gold
  ["#EBC6A8", "#D5AE90"],  // peach
  ["#715A45", "#5A4535"],  // brown
  ["#B8A088", "#8B7355"],  // warm taupe
];

export function hashHue(str) {
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export function gradientFor(hash) {
  const [from, to] = PLACEHOLDER_PALETTES[hash % PLACEHOLDER_PALETTES.length];
  return "linear-gradient(150deg, " + from + " 0%, " + to + " 115%)";
}

export function initials(name) {
  return (name || "?").trim().slice(0, 1).toUpperCase();
}

export function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ":" + String(s).padStart(2, "0");
}

export function timeAgo(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "vừa xong";
  if (min < 60) return min + " phút trước";
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + " giờ trước";
  return Math.floor(hr / 24) + " ngày trước";
}

export function formatDate(iso) {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return d + "/" + m + "/" + y;
}

export function statusLabel(status) {
  if (status === "pending") return "Đang chờ duyệt";
  if (status === "rejected") return "Đã bị từ chối";
  return "";
}

export function formatCount(n) {
  n = n || 0;
  if (n < 1000) return String(n);
  if (n < 1000000) return (n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0) + "K";
  return (n / 1000000).toFixed(1) + "M";
}

// Real, computed from the actual clock — never a static "Chào bạn."
export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "Đêm khuya tĩnh lặng";
  if (h < 11) return "Buổi sáng rạng rỡ";
  if (h < 14) return "Buổi trưa ấm áp";
  if (h < 18) return "Buổi chiều dịu dàng";
  return "Buổi tối an yên";
}
