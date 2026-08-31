import TrackCard from "./TrackCard";

// A horizontally-scrolling shelf of TrackCards — Recently Played, New
// Releases, Trending, Recommended all use this same shape, per §57
// (every home section shares one card family, not a bespoke layout each).
// `tracks` also doubles as that rail's own play queue, same pattern already
// used by HomePage/SavedPage/ProfilePage: onPlay(list, index).
export default function TrackRail({ title, subtitle, tracks, emptyHint,
  session, current, isPlaying, progress,
  onPlay, onLike, onSave, onShare, onComment, onLyrics, onAddToPlaylist,
}) {
  if (!tracks || tracks.length === 0) {
    if (!emptyHint) return null;
    return (
      <section className="rail">
        <div className="rail-head">
          <h2>{title}</h2>
          {subtitle && <p className="sub">{subtitle}</p>}
        </div>
        <p className="rail-empty-hint">{emptyHint}</p>
      </section>
    );
  }

  return (
    <section className="rail">
      <div className="rail-head">
        <h2>{title}</h2>
        {subtitle && <p className="sub">{subtitle}</p>}
      </div>
      <div className="rail-track">
        {tracks.map((t, i) => (
          <div className="rail-item" key={t.id}>
            <TrackCard
              track={t} session={session} index={i}
              isCurrent={!!current && current.trackId === t.id} isPlaying={isPlaying} progress={progress}
              onPlay={() => onPlay(tracks, i)}
              onLike={() => onLike(t.id)} onSave={() => onSave(t.id)}
              onShare={() => onShare(t)} onComment={() => onComment(t.id)} onLyrics={() => onLyrics(t.id)}
              onAddToPlaylist={onAddToPlaylist}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
