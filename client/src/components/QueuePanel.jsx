import { motion } from "framer-motion";
import { Play, Pause, X } from "lucide-react";
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

  return (
    <>
      <h2 id="queue-title" className="sheet-title">Hàng chờ</h2>
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
        <p className="section-label" style={{ marginBottom: 0 }}>Tiếp theo</p>
        {upcoming.length > 0 && (
          <button type="button" className="link-btn" onClick={onClearUpcoming}>Xoá danh sách chờ</button>
        )}
      </div>
      {upcoming.length === 0 ? (
        <p className="sub">Không có bài nào tiếp theo.</p>
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
