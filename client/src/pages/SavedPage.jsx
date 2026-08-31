import TrackCard from "../components/TrackCard";
import EmptyState from "../components/EmptyState";

export default function SavedPage({ savedList, session, current, isPlaying, progress, onPlay, onLike, onSave, onShare, onComment, onLyrics, onAddToPlaylist }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h1>Đã lưu</h1>
          <p className="sub">Những bài bạn muốn nghe lại.</p>
        </div>
      </div>
      {savedList.length === 0 ? (
        <EmptyState title="Chưa lưu bài nào" subtitle="Bấm biểu tượng lưu trên một bài hát để giữ nó lại đây." />
      ) : (
        <div className="track-grid">
          {savedList.map((t, i) => (
            <TrackCard
              key={t.id} track={t} session={session} index={i}
              isCurrent={!!current && current.trackId === t.id} isPlaying={isPlaying} progress={progress}
              onPlay={() => onPlay(savedList, i)}
              onLike={() => onLike(t.id)} onSave={() => onSave(t.id)}
              onShare={() => onShare(t)} onComment={() => onComment(t.id)} onLyrics={() => onLyrics(t.id)}
              onAddToPlaylist={onAddToPlaylist}
            />
          ))}
        </div>
      )}
    </section>
  );
}
