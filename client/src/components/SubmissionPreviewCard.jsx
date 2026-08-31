import { FileText, FileX, Video, VideoOff, ShieldAlert } from "lucide-react";
import ArtistBadge from "./ArtistBadge";
import { creditRoleLabel } from "../lib/submissions";
import { gradientFor, hashHue, formatDate } from "../lib/format";

export default function SubmissionPreviewCard({
  title, coverPreviewSrc, primaryArtist, credits, genres,
  hasLyrics, hasVideo, audioPreviewSrc, releaseDate, isExplicit,
}) {
  const featured = credits.filter((c) => c.role !== "main");
  return (
    <div className="submit-section">
      <div style={{ display: "flex", gap: "var(--sp-4)", alignItems: "flex-start", marginBottom: "var(--sp-4)" }}>
        <div
          style={{
            width: 120, height: 120, borderRadius: "var(--r-card)", flexShrink: 0,
            backgroundSize: "cover", backgroundPosition: "center", boxShadow: "var(--shadow-art)",
            ...(coverPreviewSrc ? { backgroundImage: "url('" + coverPreviewSrc + "')" } : { background: gradientFor(hashHue(title || "4ANG")) })
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: "var(--fs-lg)", fontWeight: 700, color: "var(--text-bright)", marginBottom: 4 }}>
            {title || "Chưa đặt tên"}{isExplicit && <span style={{ fontSize: "var(--fs-2xs)", background: "var(--danger)", color: "white", padding: "1px 5px", borderRadius: "var(--r-pill)", marginLeft: 6, verticalAlign: "middle" }}>E</span>}
          </div>
          <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
            {primaryArtist.artistName} <ArtistBadge badge={primaryArtist.badge} size={13} />
          </div>
          {featured.length > 0 && (
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-faint)", marginTop: 4 }}>
              {featured.map((c, i) => (
                <span key={i}>{c.artistName || c.externalName} · {creditRoleLabel(c.role)}{i < featured.length - 1 ? " · " : ""}</span>
              ))}
            </div>
          )}
          {releaseDate && <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-faint)", marginTop: 4 }}>Phát hành dự kiến {formatDate(releaseDate)}</div>}
        </div>
      </div>

      {genres.length > 0 && (
        <div className="genre-chip-row" style={{ marginBottom: "var(--sp-3)" }}>
          {genres.map((g) => <span key={g} className="genre-chip">{g}</span>)}
        </div>
      )}

      <div style={{ display: "flex", gap: "var(--sp-4)", fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginBottom: "var(--sp-3)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, color: hasLyrics ? "var(--c-sage-deep)" : "var(--text-faint)" }}>
          {hasLyrics ? <FileText size={14} /> : <FileX size={14} />} {hasLyrics ? "Có lời bài hát" : "Không có lời"}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, color: hasVideo ? "var(--c-sage-deep)" : "var(--text-faint)" }}>
          {hasVideo ? <Video size={14} /> : <VideoOff size={14} />} {hasVideo ? "Có video ca nhạc" : "Không có video"}
        </span>
      </div>

      {audioPreviewSrc ? (
        <audio controls preload="metadata" src={audioPreviewSrc} style={{ width: "100%", borderRadius: "var(--r-btn)" }} />
      ) : (
        <p className="sub" style={{ display: "flex", alignItems: "center", gap: 6 }}><ShieldAlert size={13} /> Chưa có file nhạc để nghe thử.</p>
      )}
    </div>
  );
}
