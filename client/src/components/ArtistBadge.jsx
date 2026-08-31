import { BadgeCheck } from "lucide-react";

// badge: "independent" | "verified" | null/undefined (renders nothing)
// The distinction is never color-only — the accessible label always
// names the actual status, per the brief's accessibility requirement.
export default function ArtistBadge({ badge, size = 14, showLabel = false, className = "" }) {
  if (badge !== "independent" && badge !== "verified") return null;
  const label = badge === "verified" ? "Đã xác minh bởi 4ANG" : "Nghệ sĩ độc lập trên 4ANG";
  return (
    <span
      className={"artist-badge artist-badge-" + badge + " " + className}
      role="img"
      aria-label={label}
      title={label}
    >
      <BadgeCheck size={size} />
      {showLabel && <span className="artist-badge-label">{label}</span>}
    </span>
  );
}
