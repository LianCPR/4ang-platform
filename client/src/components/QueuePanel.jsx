import { motion } from "framer-motion";
import { Play, Pause, X, ListMusic } from "lucide-react";
import { gradientFor, hashHue } from "../lib/format";

function QueueRow({ item, isCurrent, isPlaying, onPlay, onRemove }) {
  const artStyle = item.__isYT
    ? { backgroundImage: "url('" + item.thumb + "')" }
    : { background: gradientFor(hashHue(item.title)) };
  const artist = item.__isYT ? item.artist : (item.composer || item.uploaderDisplayName);

  return (
    <motion.div
      className={"queue-row" + (isCurrent ? " current" : "")}
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
    >
      <button type="button" className="queue-row-art" style={artStyle} onClick={onPlay} aria-label={isCurrent ? (isPlaying ? "Đang phát" : "Tạm dừng") : "Phát bài này"}>
        {isCurrent && (
          <span className="queue-row-art-overlay">{isPlaying ? <Pause size={16} /> : <Play size={16} />}</span>
        )}
      </button>
      <div className="queue-row-info" onClick={onPlay}>
        <div className="queue-row-title">{item.title}</div>
        <div className="queue-row-artist">{artist}</div>
      </div>
      {!isCurrent && (
        <button type="button" className="icon-btn queue-row-remove" onClick={onRemove} aria-label="Xoá khỏi hàng chờ">
          <X size={15} />
        </button>
      )}
    </motion.div>
  );
}

export default function QueuePanel({ queue, queueIndex, isPlaying, onPlayAt, onRemove, onClearUpcoming, onTogglePlayPause }) {
  const upcoming = queue.slice(queueIndex + 1);
  const totalTracks = queue.length;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
        <h2 id="queue-title" className="sheet-title" style={{ margin: 0 }}>Hàng chờ</h2>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)' }}>{totalTracks} bài</span>
      </div>
      {queue[queueIndex] && (
        <>
          <p className="section-label">Đang phát</p>
          <QueueRow
            item={queue[queueIndex]} isCurrent isPlaying={isPlaying}
            onPlay={onTogglePlayPause} onRemove={() => {}}
          />
        </>
      )}
      <div className="queue-upcoming-head">
        <p className="section-label" style={{ marginBottom: 0 }}>Tiếp theo ({upcoming.length})</p>
        {upcoming.length > 0 && (
          <button type="button" className="link-btn" onClick={onClearUpcoming}>Xoá tất cả</button>
        )}
      </div>
      {upcoming.length === 0 ? (
        <div style={{ padding: 'var(--sp-6) 0', textAlign: 'center', color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>
          <ListMusic size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
          <p>Hàng chờ trống.</p>
          <p style={{ fontSize: 'var(--fs-xs)', marginTop: 4 }}>Nhấn ••• trên bài hát để thêm vào hàng chờ.</p>
        </div>
      ) : (
        upcoming.map((item, i) => {
          const realIndex = queueIndex + 1 + i;
          return (
            <QueueRow
              key={item.id + "-" + realIndex}
              item={item} isCurrent={false} isPlaying={false}
              onPlay={() => onPlayAt(realIndex)}
              onRemove={() => onRemove(realIndex)}
            />
          );
        })
      )}
    </>
  );
}
