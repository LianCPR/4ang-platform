import { motion } from "framer-motion";
import { Heart, SkipBack, SkipForward, Play, Pause, Shuffle, Repeat, Volume2, Music } from "lucide-react";
import { gradientFor, hashHue, formatTime } from "../lib/format";
import VinylRecord from "./VinylRecord";
import { Flower, Butterfly } from "../assets/Botanical";

function TrendingItem({ track, index, isCurrent, isPlaying, onPlay }) {
  const hue = hashHue(track.title);
  const artist = (track.credits && track.credits[0] ? track.credits[0].artistName : track.composer || track.uploaderDisplayName);
  const cover = track.coverUrl || null;

  return (
    <button type="button" className={"trending-item" + (isCurrent ? " trending-item-active" : "")} onClick={onPlay}>
      <span className="trending-rank">{String(index + 1).padStart(2, "0")}</span>
      <div
        className="trending-art"
        style={cover ? { backgroundImage: "url('" + cover + "')" } : { background: gradientFor(hue) }}
      />
      <div className="trending-info">
        <div className="trending-title">{track.title}</div>
        <div className="trending-artist">{artist}</div>
      </div>
      <span className="trending-duration">{formatTime(track.duration || 0)}</span>
    </button>
  );
}

export default function RightPanel({
  trending, current, currentTrack, isPlaying, progress,
  session, volume, queue, queueIndex,
  onPlay, onLike, onToggle, onPrev, onNext, onSeek, onVolume, onOpenQueue,
  shuffleEnabled, onShuffleToggle, repeatMode, onRepeatToggle,
}) {
  const liked = currentTrack ? currentTrack.likedBy.includes(session.username) : false;
  const pct = progress.dur > 0 ? Math.round((progress.cur / progress.dur) * 1000) : 0;
  const upNext = queue.slice(queueIndex + 1, queueIndex + 6);

  return (
    <aside className="right-panel">
      {/* TRENDING NOW */}
      <div className="right-panel-section">
        <div className="right-panel-header">
          <p className="right-panel-label">TRENDING NOW</p>
          {trending.length > 0 && <button type="button" className="link-btn view-all-btn">VIEW ALL</button>}
        </div>
        {trending.length > 0 ? (
          <div className="trending-list">
            {trending.slice(0, 5).map((t, i) => (
              <TrendingItem
                key={t.id} track={t} index={i}
                isCurrent={current && current.trackId === t.id}
                isPlaying={isPlaying}
                onPlay={() => onPlay(trending, i)}
              />
            ))}
          </div>
        ) : (
          <div className="np-empty-state" style={{ padding: "var(--sp-3) 0" }}>
            <Music size={20} style={{ opacity: 0.15, color: "var(--c-sage)" }} />
            <p className="sub" style={{ fontSize: "var(--fs-xs)", textAlign: "center" }}>Chưa có dữ liệu trending.</p>
          </div>
        )}
      </div>

      {/* NOW PLAYING */}
      <div className="right-panel-section right-panel-np">
        <div className="right-panel-header">
          <p className="right-panel-label">NOW PLAYING</p>
        </div>

        {currentTrack ? (
          <>
            <div className="now-playing-mini">
              <div
                className="now-playing-mini-art"
                style={currentTrack.coverUrl ? { backgroundImage: "url('" + currentTrack.coverUrl + "')" } : { background: gradientFor(hashHue(currentTrack.title)) }}
              />
              <div className="now-playing-mini-info">
                <div className="now-playing-mini-title">{currentTrack.title}</div>
                <div className="now-playing-mini-artist">
                  {currentTrack.credits && currentTrack.credits[0] ? currentTrack.credits[0].artistName : currentTrack.composer || currentTrack.uploaderDisplayName}
                </div>
              </div>
              <motion.button
                type="button"
                className={"icon-btn" + (liked ? " active active-wine" : "")}
                onClick={() => onLike(current.trackId)}
                whileTap={{ scale: 0.9 }}
                aria-label="Thả tym"
              >
                <Heart size={15} fill={liked ? "currentColor" : "none"} />
              </motion.button>
            </div>

            <div className="now-playing-progress">
              <span className="np-time">{formatTime(progress.cur)}</span>
              <input
                type="range" min="0" max="1000" value={pct}
                onChange={(e) => onSeek(Number(e.target.value))}
                className="np-range"
                aria-label="Tiến trình"
              />
              <span className="np-time">{formatTime(progress.dur)}</span>
            </div>

            <div className="vinyl-showcase">
              <div className="vinyl-flower-left">
                <Flower size={20} style={{ opacity: 0.2, color: "var(--c-rose)" }} />
              </div>
              <VinylRecord
                artUrl={currentTrack.coverUrl || null}
                artHue={hashHue(currentTrack.title)}
                isPlaying={isPlaying}
                size={160}
                className="vinyl-large"
              />
              <div className="vinyl-flower-right">
                <Butterfly size={14} style={{ opacity: 0.15, color: "var(--c-sage)" }} />
              </div>
            </div>

            <div className="now-playing-controls">
              <motion.button type="button" className={"icon-btn" + (shuffleEnabled ? " active" : "")} onClick={onShuffleToggle} whileTap={{ scale: 0.9 }} aria-label="Shuffle">
                <Shuffle size={15} />
              </motion.button>
              <motion.button type="button" className="icon-btn" onClick={onPrev} whileTap={{ scale: 0.9 }} aria-label="Bài trước">
                <SkipBack size={18} />
              </motion.button>
              <motion.button type="button" className="play-btn-lg" onClick={onToggle} whileTap={{ scale: 0.92 }} aria-label={isPlaying ? "Tạm dừng" : "Phát"}>
                {isPlaying ? <Pause size={22} /> : <Play size={22} style={{ marginLeft: 2 }} />}
              </motion.button>
              <motion.button type="button" className="icon-btn" onClick={onNext} whileTap={{ scale: 0.9 }} aria-label="Bài tiếp">
                <SkipForward size={18} />
              </motion.button>
              <motion.button type="button" className={"icon-btn" + (repeatMode !== 'off' ? " active" : "")} onClick={onRepeatToggle} whileTap={{ scale: 0.9 }} aria-label="Repeat" style={{position:'relative'}}>
                <Repeat size={15} />
                {repeatMode === 'one' && <span style={{fontSize:8,position:'absolute',bottom:2,right:2,fontWeight:700}}>1</span>}
              </motion.button>
            </div>

            <div className="now-playing-volume">
              <Volume2 size={13} />
              <input
                type="range" min="0" max="100" value={volume}
                onChange={(e) => onVolume(Number(e.target.value))}
                className="np-range np-range-sm"
                aria-label="Âm lượng"
              />
            </div>

            {upNext.length > 0 && (
              <div className="up-next-section">
                <div className="right-panel-header">
                  <p className="right-panel-label">UP NEXT</p>
                  <button type="button" className="link-btn view-all-btn" onClick={onOpenQueue}>VIEW QUEUE</button>
                </div>
                <div className="up-next-list">
                  {upNext.map((item, i) => (
                    <div key={item.id + "-" + (queueIndex + 1 + i)} className="up-next-item" onClick={() => onPlay(queue, queueIndex + 1 + i)}>
                      <div
                        className="up-next-art"
                        style={item.thumb ? { backgroundImage: "url('" + item.thumb + "')" } : { background: gradientFor(hashHue(item.title)) }}
                      />
                      <div className="up-next-info">
                        <div className="up-next-title">{item.title}</div>
                        <div className="up-next-artist">{item.artist}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="np-empty-state">
            <div className="np-empty-icon">
              <Music size={28} style={{ color: "var(--c-sage)" }} />
            </div>
            <p className="np-empty-text">Chọn một bài hát để bắt đầu.</p>
          </div>
        )}
      </div>
    </aside>
  );
}
