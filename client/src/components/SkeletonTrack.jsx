/**
 * Reusable skeleton loading components.
 * Shows animated placeholders while data loads.
 */

/** Single track row skeleton (used in lists) */
export function SkeletonTrackRow() {
  return (
    <div className="sk-track-row">
      <div className="sk-art sk-pulse" />
      <div className="sk-lines">
        <div className="sk-line sk-line-title sk-pulse" />
        <div className="sk-line sk-line-sub sk-pulse" />
      </div>
    </div>
  );
}

/** Track card skeleton (used in grids) */
export function SkeletonTrackCard() {
  return (
    <div className="sk-track-card">
      <div className="sk-art sk-art-square sk-pulse" />
      <div className="sk-line sk-line-title sk-pulse" />
      <div className="sk-line sk-line-sub sk-pulse" />
    </div>
  );
}

/** Artist card skeleton */
export function SkeletonArtistCard() {
  return (
    <div className="sk-artist-card">
      <div className="sk-avatar sk-pulse" />
      <div className="sk-line sk-line-title sk-pulse" />
      <div className="sk-line sk-line-sub sk-pulse" />
    </div>
  );
}

/** Playlist card skeleton */
export function SkeletonPlaylistCard() {
  return (
    <div className="sk-playlist-card">
      <div className="sk-art sk-art-square sk-pulse" />
      <div className="sk-line sk-line-title sk-pulse" />
      <div className="sk-line sk-line-sub sk-pulse" />
    </div>
  );
}

/** Generic grid of skeleton cards */
export function SkeletonGrid({ count = 6, type = "track" }) {
  const Component = type === "artist" ? SkeletonArtistCard
    : type === "playlist" ? SkeletonPlaylistCard
    : SkeletonTrackCard;

  return (
    <div className="sk-grid">
      {Array.from({ length: count }, (_, i) => (
        <Component key={i} />
      ))}
    </div>
  );
}

/** Track list skeleton (vertical list of rows) */
export function SkeletonTrackList({ count = 5 }) {
  return (
    <div className="sk-list">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonTrackRow key={i} />
      ))}
    </div>
  );
}
