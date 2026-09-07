import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, Music, Radio, ListMusic, UserPlus, Check, X, Users, Sparkles,
} from "lucide-react";
import { api } from "../../api";
import { gradientFor, hashHue, timeAgo, formatCount } from "../../lib/format";

/* ─── Small building blocks ─────────────────────────── */

function Avatar({ person, size = 40 }) {
  return (
    <div
      className="disco-avatar"
      style={Object.assign(
        { width: size, height: size, fontSize: size * 0.42 },
        person?.avatarUrl ? { backgroundImage: `url('${person.avatarUrl}')` } : { background: gradientFor(hashHue(person?.username || "?")) }
      )}
    >
      {!person?.avatarUrl && <span>{(person?.displayName || person?.username || "U")[0]}</span>}
    </div>
  );
}

function Why({ reasons }) {
  if (!reasons || reasons.length === 0) return null;
  return (
    <div className="disco-why">
      {reasons.map((r, i) => (
        <span key={i} className="disco-why-chip">{r}</span>
      ))}
    </div>
  );
}

function SectionHead({ title, sub }) {
  return (
    <div className="disc-section-head">
      <h2>{title}</h2>
      <span className="disc-section-sub">{sub}</span>
    </div>
  );
}

function SongRow({ t, index, list, isCur, isPlaying, onPlay, extra }) {
  return (
    <div
      className={"disc-song-row disco-song-row" + (isCur ? " disc-row-active" : "")}
      onClick={() => onPlay(list, index)}
    >
      <span className="disc-rank">
        {isCur && isPlaying ? <span className="disc-eq"><span /><span /><span /></span> : (index + 1)}
      </span>
      <div
        className="disc-row-art"
        style={t.coverUrl ? { backgroundImage: `url('${t.coverUrl}')` } : { background: gradientFor(hashHue(t.title)) }}
      />
      <div className="disc-row-info">
        <div className="disc-row-title">{t.title}</div>
        <div className="disc-row-artist">
          {(t.primaryArtistName || t.uploaderDisplayName || t.composer || "Unknown")}
        </div>
        <Why reasons={t.reasons} />
      </div>
      {extra || null}
      <span className="disc-row-dur">{formatCount(t.playCount || 0)} lượt nghe</span>
      <button
        className="disc-row-play"
        aria-label="Play"
        onClick={(e) => { e.stopPropagation(); onPlay(list, index); }}
      >
        {isCur && isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
      </button>
    </div>
  );
}

function ArtistNameLink({ track, onOpenArtist }) {
  const name = track.primaryArtistName || track.uploaderDisplayName || track.composer;
  if (track.primaryArtistUsername || track.uploaderUsername) {
    return (
      <span
        className="disc-artist-link"
        onClick={(e) => { e.stopPropagation(); onOpenArtist?.(track.primaryArtistUsername || track.uploaderUsername); }}
      >
        {name}
      </span>
    );
  }
  return <span>{name || "Unknown"}</span>;
}

/* ─── Sections ──────────────────────────────────────── */

function FriendsListening({ items, current, isPlaying, onPlay, onOpenArtist }) {
  const list = items.map((i) => i.track);
  return (
    <div className="disco-friends">
      {items.map((item, i) => {
        const t = item.track;
        const isCur = current?.trackId === t.id;
        return (
          <div key={t.id} className="disco-friend-row">
            <div className="disco-friend-person" onClick={() => onOpenArtist?.(item.person?.username)}>
              <Avatar person={item.person} size={38} />
              <div className="disco-friend-who">
                <span className="disco-friend-name">
                  {item.person?.displayName || item.person?.username}
                  {item.person?.mutual && <span className="disco-mutual" title="Quan tâm lẫn nhau">•</span>}
                </span>
                <span className="disco-friend-verb">đang nghe • {timeAgo(item.heardAt)}</span>
              </div>
            </div>
            <div className="disco-friend-listen" onClick={() => onPlay(list, i)}>
              <div
                className="disco-friend-art"
                style={t.coverUrl ? { backgroundImage: `url('${t.coverUrl}')` } : { background: gradientFor(hashHue(t.title)) }}
              >
                <span className="disco-friend-play">{isCur && isPlaying ? <Pause size={12} fill="white" /> : <Play size={12} fill="white" />}</span>
              </div>
              <div className="disco-friend-track">
                <span className="disco-friend-title">{t.title}</span>
                <span className="disco-friend-artist"><ArtistNameLink track={t} onOpenArtist={onOpenArtist} /></span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PeopleCard({ person, following, onFollow, onDismiss, match }) {
  return (
    <motion.div className="disco-person-card" layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
      <div className="disco-person-top">
        <Avatar person={person} size={46} />
        <div className="disco-person-info">
          <span className="disco-person-name">{person.displayName || person.username}</span>
          {match != null && <span className="disco-person-match">{match}% hợp gu</span>}
          {(person.reasons || []).length > 0 && (
            <span className="disco-person-reason">{(person.reasons || [])[0]}</span>
          )}
        </div>
      </div>
      {(person.similarIn || []).length > 0 && (
        <div className="disco-person-similar">
          {(person.similarIn || []).map((s, i) => (
            <span key={i} className="disco-similar-chip">
              {s.type === "artist" ? <Sparkles size={10} /> : <Music size={10} />} {s.name}
            </span>
          ))}
          {person.sharedItems >= 2 && !person.similarIn?.length && (
            <span className="disco-similar-chip"><Sparkles size={10} /> {person.sharedItems} điểm chung</span>
          )}
        </div>
      )}
      <div className="disco-person-actions">
        <button
          className={"disco-btn" + (following ? " disco-btn-following" : " disco-btn-follow")}
          onClick={() => onFollow(person.username)}
        >
          {following ? <><Check size={13} /> Đang theo dõi</> : <><UserPlus size={13} /> Theo dõi</>}
        </button>
        <button className="disco-btn-ghost" aria-label="Dismiss" onClick={() => onDismiss(person.username)}>
          <X size={15} />
        </button>
      </div>
    </motion.div>
  );
}

/* ─── Main component ────────────────────────────────── */

export default function SocialDiscovery({
  session, current, isPlaying, onPlay, onOpenArtist, onOpenRoom, onOpenPlaylist, showToast, onOpenPost,
}) {
  const [payload, setPayload] = useState(null); // { hasSocialData, sections }
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState({});
  const [dismissed, setDismissed] = useState({});

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await api.discoverSocial();
      setPayload(res);
    } catch {
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const click = useCallback((section, trackId) => {
    api.discoverClick(section, "track", trackId).catch(() => {});
  }, []);

  const follow = useCallback(async (username) => {
    try {
      await api.followUser(username);
      setFollowing((f) => ({ ...f, [username]: true }));
      showToast?.("Đã theo dõi " + username);
    } catch {
      showToast?.("Không thể theo dõi.");
    }
  }, [showToast]);

  const dismiss = useCallback((username) => {
    setDismissed((d) => ({ ...d, [username]: true }));
  }, []);

  if (!session) return null;
  if (loading) return null; // general sections above still render
  if (!payload || !payload.hasSocialData) return null;

  const S = payload.sections;
  const playList = (list, i) => { onPlay(list, i || 0); };
  const playClicked = (section, list, i) => {
    const t = list[i];
    if (t && t.id) click(section, t.id);
    playList(list, i);
  };

  return (
    <div className="disco">
      {S.friendsListening?.length > 0 && (
        <div className="disc-section disco-section">
          <SectionHead title="BẠN BÈ ĐANG NGHE" sub="Hoạt động nghe mới nhất từ những người bạn theo dõi" />
          <FriendsListening
            items={S.friendsListening}
            current={current} isPlaying={isPlaying}
            onPlay={(list, i) => playClicked("friends-listening", list, i)}
            onOpenArtist={onOpenArtist}
          />
        </div>
      )}

      {S.artistUpdates?.length > 0 && (
        <div className="disc-section disco-section">
          <SectionHead title="TỪ NGHỆ SĨ BẠN THEO DÕI" sub="Bài đăng và thông báo phát hành mới" />
          <div className="disc-post-list">
            {S.artistUpdates.map((p) => {
              const t = p.target;
              return (
                <div key={p.id} className="disc-post-item" onClick={() => onOpenPost?.(p.id, "artist_post")}>
                  <div className="disc-post-head">
                    <span className="disc-post-name">{p.displayName}</span>
                    {p.isFeatured && <span className="disc-post-featured">★ Ghim</span>}
                    <span className="disc-post-time">{timeAgo(p.createdAt)}</span>
                  </div>
                  {p.message && <p className="disc-post-message">{p.message}</p>}
                  {t && (
                    <div className="disc-post-target">
                      <div className="disc-post-art" style={t.coverUrl ? { backgroundImage: `url('${t.coverUrl}')` } : { background: gradientFor(hashHue(t.title)) }} />
                      <div className="disc-post-info">
                        <div className="disc-post-title">{t.title}</div>
                        <div className="disc-post-sub">{t.type === "track" ? t.artist : t.type === "release" ? (t.releaseType || "Phát hành") + (t.trackCount ? ` • ${t.trackCount} bài` : "") : `${t.trackCount || 0} bài hát`}</div>
                      </div>
                    </div>
                  )}
                  <Why reasons={p.reason} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {S.trendingInCircle?.length > 0 && (
        <div className="disc-section disco-section">
          <SectionHead title="ĐANG HOT TRONG VÒNG KẾT NỐI" sub="Được nhiều người bạn theo dõi yêu thích" />
          <div className="disc-song-list">
            {S.trendingInCircle.map((t, i) => (
              <SongRow
                key={t.id} t={t} index={i} list={S.trendingInCircle}
                isCur={current?.trackId === t.id} isPlaying={isPlaying}
                onPlay={(list, idx) => playClicked("trending-in-circle", list, idx)}
              />
            ))}
          </div>
        </div>
      )}

      {S.fromArtistsYouFollow?.length > 0 && (
        <div className="disc-section disco-section">
          <SectionHead title="MỚI TỪ NGHỆ SĨ BẠN THEO DÕI" sub="Bản phát hành gần đây từ các nghệ sĩ" />
          <div className="disc-song-list">
            {S.fromArtistsYouFollow.map((t, i) => (
              <SongRow
                key={t.id} t={t} index={i} list={S.fromArtistsYouFollow}
                isCur={current?.trackId === t.id} isPlaying={isPlaying}
                onPlay={(list, idx) => playClicked("from-artists", list, idx)}
              />
            ))}
          </div>
        </div>
      )}

      {S.becauseYouLiked?.length > 0 && (
        <div className="disc-section disco-section">
          <SectionHead title="VÌ BẠN THÍCH" sub="Dựa trên nghệ sĩ và thể loại bạn yêu thích" />
          <div className="disc-song-list">
            {S.becauseYouLiked.map((t, i) => (
              <SongRow
                key={t.id} t={t} index={i} list={S.becauseYouLiked}
                isCur={current?.trackId === t.id} isPlaying={isPlaying}
                onPlay={(list, idx) => playClicked("because-you-liked", list, idx)}
              />
            ))}
          </div>
        </div>
      )}

      {S.sharedWithYou?.length > 0 && (
        <div className="disc-section disco-section">
          <SectionHead title="ĐƯỢC CHIA SẺ VỚI BẠN" sub="Bài hát và playlist từ những người bạn theo dõi" />
          <div className="disc-song-list">
            {(() => {
              const trackItems = S.sharedWithYou.map((x) => x.track).filter(Boolean);
              return S.sharedWithYou.map((item) => {
                if (item.type === "playlist") {
                  const pl = item.playlist;
                  return (
                    <div key={"pl-" + pl.id} className="disc-song-row disco-share-row" onClick={() => onOpenPlaylist?.(pl.id)}>
                      <span className="disc-rank"><ListMusic size={15} /></span>
                      <div
                        className="disc-row-art"
                        style={pl.coverUrl ? { backgroundImage: `url('${pl.coverUrl}')` } : { background: gradientFor(hashHue(pl.title)) }}
                      />
                      <div className="disc-row-info">
                        <div className="disc-row-title">{pl.title}</div>
                        <div className="disc-row-artist">{item.by?.displayName || item.by?.username}</div>
                        <Why reasons={item.reasons} />
                      </div>
                      <span className="disc-row-dur">{pl.trackCount} bài</span>
                      <button className="disc-row-play" aria-label="Open playlist" onClick={(e) => { e.stopPropagation(); onOpenPlaylist?.(pl.id); }}>
                        <Music size={14} />
                      </button>
                    </div>
                  );
                }
                const t = item.track;
                const tIndex = trackItems.indexOf(t);
                return (
                  <SongRow
                    key={t.id} t={t} index={tIndex} list={trackItems}
                    isCur={current?.trackId === t.id} isPlaying={isPlaying}
                    onPlay={(list, idx) => playClicked("shared-with-you", list, idx)}
                  />
                );
              });
            })()}
          </div>
        </div>
      )}

      {S.playlistsFromNetwork?.length > 0 && (
        <div className="disc-section disco-section">
          <SectionHead title="PLAYLIST CỘNG ĐỒNG" sub="Playlist công khai từ những người bạn theo dõi" />
          <div className="disc-new-scroll disco-playlist-rail">
            {S.playlistsFromNetwork.map((pl) => (
              <div key={pl.id} className="disc-new-card" onClick={() => onOpenPlaylist?.(pl.id)}>
                <div
                  className="disc-new-art"
                  style={pl.coverUrl ? { backgroundImage: `url('${pl.coverUrl}')` } : { background: gradientFor(hashHue(pl.title)) }}
                >
                  <div className="disc-new-overlay"><ListMusic size={20} /></div>
                </div>
                <div className="disc-new-title">{pl.title}</div>
                <div className="disc-new-artist">{pl.ownerDisplayName}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {S.roomsFromNetwork?.length > 0 && (
        <div className="disc-section disco-section">
          <SectionHead title="PHÒNG CỦA BẠN BÈ" sub="Phòng nghe nhạc đang mở từ những người bạn theo dõi" />
          <div className="disc-new-scroll disco-room-rail">
            {S.roomsFromNetwork.map((room) => (
              <div key={room.id} className="disco-room-card" onClick={() => onOpenRoom?.(room.id)}>
                <div className="disco-room-top">
                  <Avatar person={room.host} size={30} />
                  <div className="disco-room-name">{room.name}</div>
                  <span className="disco-room-live"><Radio size={11} /> LIVE</span>
                </div>
                {room.song ? (
                  <div className="disco-room-song">
                    <div
                      className="disco-room-art"
                      style={room.song.coverUrl ? { backgroundImage: `url('${room.song.coverUrl}')` } : {}}
                    >
                      <Play size={14} fill="white" />
                    </div>
                    <div className="disco-room-songinfo">
                      <span className="disco-room-title">{room.song.title}</span>
                      <span className="disco-room-artist">{room.song.artist}</span>
                    </div>
                  </div>
                ) : (
                  <div className="disco-room-song disco-room-song-empty"><Users size={14} /> Chưa có bài hát</div>
                )}
                <div className="disco-room-bottom">
                  <span className="disco-room-count"><Users size={11} /> {room.participantCount} người</span>
                  <button className="disco-btn disco-btn-join" onClick={(e) => { e.stopPropagation(); onOpenRoom?.(room.id); }}>
                    Nghe cùng
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {S.tasteMatches?.length > 0 && (
        <div className="disc-section disco-section">
          <SectionHead title="NGƯỜI CÙNG GU" sub="Họ có gu nghe nhạc gần với bạn" />
          <div className="disco-people-grid">
            <AnimatePresence>
              {(S.tasteMatches || [])
                .filter((p) => !dismissed[p.username])
                .map((p) => (
                  <PeopleCard
                    key={p.username} person={p}
                    following={!!following[p.username]}
                    onFollow={follow} onDismiss={dismiss}
                  />
                ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {S.peopleSuggestions?.length > 0 && (
        <div className="disc-section disco-section">
          <SectionHead title="GỢI Ý THEO DÕI" sub="Những người có thể bạn sẽ thấy thú vị" />
          <div className="disco-people-grid">
            <AnimatePresence>
              {(S.peopleSuggestions || [])
                .filter((p) => !dismissed[p.username])
                .map((p) => (
                  <PeopleCard
                    key={p.username} person={p}
                    following={!!following[p.username]}
                    onFollow={follow} onDismiss={dismiss}
                  />
                ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}