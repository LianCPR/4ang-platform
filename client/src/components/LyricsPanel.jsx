import { Flower } from "../assets/Botanical";

export default function LyricsPanel({ track }) {
  return (
    <>
      <h2 id="lyrics-title" className="sheet-title" style={{ marginBottom: 4 }}>{track ? track.title : "Lời bài hát"}</h2>
      {track && track.composer && <p className="sub" style={{ marginBottom: 14 }}>Sáng tác: {track.composer}</p>}
      <div className="lyrics-editorial-body" style={{ padding: 'var(--sp-5) var(--sp-4)' }}>
        <div className="lyrics-editorial-ornament-top"><Flower size={12} /></div>
        <div className="lyrics-editorial-content">
          {track && track.lyrics ? (
            track.lyrics.split('\n').map((line, i) => (
              <p key={i} className="lyrics-line">{line === '' ? '\u00A0' : line}</p>
            ))
          ) : (
            <p className="lyrics-line" style={{ fontStyle: 'italic', color: 'var(--text-faint)' }}>
              Bài này chưa có lời.
            </p>
          )}
        </div>
        <div className="lyrics-editorial-ornament-bottom"><Flower size={12} /></div>
      </div>
    </>
  );
}
