import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, Clock, Music, Users, ListMusic, Tag, Trash2,
  Play, Pause, ChevronRight, AlertCircle,
} from "lucide-react";
import { api } from "../api";
import TrackCard from "../components/TrackCard";
import EmptyState from "../components/EmptyState";
import { gradientFor, hashHue, formatTime } from "../lib/format";

/* ── Vietnamese diacritics normalization ── */
const DIACRITICS_MAP = { a: "áàảãạăắằẳẵặâấầẩẫậ", d: "đ", e: "éèẻẽẹêếềểễệ", i: "íìỉĩị", o: "óòỏõọôốồổỗộơớờởỡợ", u: "úùủũụưứừửữự", y: "ýỳỷỹỵ" };
function stripDiacritics(str) {
  let result = str.toLowerCase().trim();
  for (const [plain, accented] of Object.entries(DIACRITICS_MAP)) {
    result = result.replace(new RegExp("[" + accented + "]", "g"), plain);
  }
  return result.replace(/\s+/g, " ");
}

function matchesQuery(text, query) {
  if (!text || !query) return false;
  const a = stripDiacritics(text);
  const b = stripDiacritics(query);
  return a.includes(b) || b.includes(a);
}

/* ── Skeleton loaders ── */
function SongSkeleton() {
  return (
    <div className="search-sk-song">
      <div className="sk-sk sk-img" />
      <div className="sk-sk-group">
        <div className="sk-sk sk-text" style={{ width: "60%" }} />
        <div className="sk-sk sk-text" style={{ width: "40%" }} />
      </div>
      <div className="sk-sk sk-text" style={{ width: 40 }} />
    </div>
  );
}
function ArtistSkeleton() {
  return (
    <div className="sk-search-artist">
      <div className="sk-sk sk-circle" />
      <div className="sk-sk sk-text" style={{ width: "70%" }} />
    </div>
  );
}
function PlaylistSkeleton() {
  return (
    <div className="sk-search-playlist">
      <div className="sk-sk sk-square" />
      <div className="sk-sk sk-text" style={{ width: "80%" }} />
      <div className="sk-sk sk-text" style={{ width: "50%" }} />
    </div>
  );
}

export default function SearchPage({
  session, tracks, current, isPlaying, progress,
  onPlay, onLike, onSave, onShare, onComment, onLyrics, onAddToPlaylist,
  onOpenArtist, onOpenGenre, onOpenPlaylist,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const latestQueryRef = useRef("");

  /* Load recent searches from localStorage + backend */
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("4ang_recent_searches") || "[]");
      if (Array.isArray(saved) && saved.length > 0) setRecentSearches(saved);
    } catch (e) { /* ignore */ }
    if (session) {
      api.searchHistory().then((res) => {
        if (res.queries && res.queries.length > 0) setRecentSearches(res.queries);
      }).catch(() => {});
    }
  }, [session]);

  /* Save to localStorage */
  const saveToRecent = useCallback((q) => {
    setRecentSearches((prev) => {
      const next = [q, ...prev.filter((h) => h !== q)].slice(0, 12);
      try { localStorage.setItem("4ang_recent_searches", JSON.stringify(next)); } catch (e) { /* ignore */ }
      return next;
    });
    if (session) api.saveSearchHistory(q).catch(() => {});
  }, [session]);

  /* Core search function with race condition protection */
  const doSearch = useCallback(async (q) => {
    const trimmed = (q || "").trim();
    if (!trimmed) { setResults(null); setError(null); return; }

    // Cancel previous request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    latestQueryRef.current = trimmed;
    setLoading(true);
    setError(null);

    try {
      const [searchRes, peopleRes] = await Promise.all([
        api.search(trimmed),
        api.searchPeople(trimmed).catch(() => ({ users: [] })),
      ]);
      // Only update if this is still the latest query
      if (latestQueryRef.current === trimmed) {
        setResults({ ...searchRes, people: peopleRes.users || [] });
        saveToRecent(trimmed);
      }
    } catch (e) {
      if (latestQueryRef.current === trimmed && !controller.signal.aborted) {
        setError("Không thể tải kết quả tìm kiếm. Vui lòng thử lại.");
        setResults({ tracks: [], artists: [], playlists: [], genres: [] });
      }
    }
    if (latestQueryRef.current === trimmed) setLoading(false);
  }, [saveToRecent]);

  /* Debounced input handler */
  const handleChange = useCallback((val) => {
    setQuery(val);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  }, [doSearch]);

  /* Submit on Enter */
  function handleKeyDown(e) {
    if (e.key === "Enter") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      doSearch(query);
    }
  }

  /* Clear search */
  function handleClear() {
    setQuery("");
    setResults(null);
    setError(null);
    setLoading(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    inputRef.current?.focus();
  }

  /* Recent search actions */
  function handleHistoryClick(q) {
    setQuery(q);
    doSearch(q);
  }

  function removeHistoryItem(q) {
    setRecentSearches((prev) => {
      const next = prev.filter((h) => h !== q);
      try { localStorage.setItem("4ang_recent_searches", JSON.stringify(next)); } catch (e) { /* ignore */ }
      return next;
    });
    if (session) api.deleteSearchHistoryItem(q).catch(() => {});
  }

  function clearAllHistory() {
    setRecentSearches([]);
    try { localStorage.removeItem("4ang_recent_searches"); } catch (e) { /* ignore */ }
    if (session) api.clearSearchHistory().catch(() => {});
  }

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  /* Keyboard shortcut: / to focus search */
  useEffect(() => {
    function handleGlobalKey(e) {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const tag = document.activeElement?.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current.blur();
      }
    }
    document.addEventListener("keydown", handleGlobalKey);
    return () => document.removeEventListener("keydown", handleGlobalKey);
  }, []);

  /* Tab categories */
  const tabs = [
    { id: "all", label: "Tất cả" },
    { id: "tracks", label: "Bài hát", icon: Music },
    { id: "artists", label: "Nghệ sĩ", icon: Users },
    { id: "people", label: "Mọi người", icon: Users },
    { id: "playlists", label: "Playlist", icon: ListMusic },
    { id: "genres", label: "Thể loại", icon: Tag },
  ];

  const filteredTracks = results?.tracks || [];
  const filteredArtists = results?.artists || [];
  const filteredPlaylists = results?.playlists || [];
  const filteredGenres = results?.genres || [];
  const filteredPeople = results?.people || [];
  const hasResults = filteredTracks.length + filteredArtists.length + filteredPlaylists.length + filteredGenres.length + filteredPeople.length > 0;

  const showSuggestions = !query && !results && !loading && !error;
  const showResults = results && hasResults;
  const showNoResults = results && !hasResults && !loading;
  const showError = error && !loading;

  /* Top result: first track or first artist */
  const topResult = useMemo(() => {
    if (!results) return null;
    if (filteredArtists.length > 0) {
      return { type: "artist", data: filteredArtists[0] };
    }
    if (filteredTracks.length > 0) {
      return { type: "track", data: filteredTracks[0] };
    }
    return null;
  }, [results, filteredArtists, filteredTracks]);

  return (
    <section className="search-page">
      {/* ── SEARCH INPUT ── */}
      <div className="search-hero">
        <div className={"search-input-wrap" + (focused ? " focused" : "")}>
          <Search size={20} className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Tìm bài hát, nghệ sĩ, album..."
            className="search-input"
            aria-label="Tìm kiếm"
            autoComplete="off"
          />
          {loading && <div className="search-spinner" />}
          {query && !loading && (
            <button type="button" className="search-clear-btn" onClick={handleClear} aria-label="Xoá tìm kiếm">
              <X size={18} />
            </button>
          )}
        </div>
        {!query && <p className="search-hint">Nhấn <kbd>/</kbd> để tìm kiếm</p>}
      </div>

      {/* ── RECENT SEARCHES (no query) ── */}
      <AnimatePresence>
        {showSuggestions && recentSearches.length > 0 && (
          <motion.div
            className="search-recent"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div className="search-recent-header">
              <h3>Tìm kiếm gần đây</h3>
              <button type="button" className="search-clear-all" onClick={clearAllHistory}>
                <Trash2 size={13} />
                <span>Xoá tất cả</span>
              </button>
            </div>
            <div className="search-recent-list">
              {recentSearches.map((q, i) => {
                const matchTrack = tracks?.find((t) => matchesQuery(t.title, q));
                return (
                  <div key={i} className="search-recent-item">
                    <button type="button" className="search-recent-btn" onClick={() => handleHistoryClick(q)}>
                      {matchTrack?.coverUrl ? (
                        <div className="search-recent-art" style={{ backgroundImage: `url('${matchTrack.coverUrl}')` }} />
                      ) : (
                        <div className="search-recent-art search-recent-art-icon">
                          <Clock size={14} />
                        </div>
                      )}
                      <span className="search-recent-text">{q}</span>
                    </button>
                    <button type="button" className="search-recent-remove" onClick={(e) => { e.stopPropagation(); removeHistoryItem(q); }} aria-label="Xoá">
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── EMPTY STATE (no query, no history) ── */}
      {showSuggestions && recentSearches.length === 0 && (
        <div className="search-empty-hint">
          <Search size={40} strokeWidth={1.2} />
          <p>Nhập tên bài hát, nghệ sĩ hoặc album để bắt đầu tìm kiếm.</p>
        </div>
      )}

      {/* ── TABS ── */}
      {results && (
        <div className="search-tabs">
          {tabs.map((t) => (
            <button key={t.id} type="button" className={"search-tab" + (activeTab === t.id ? " active" : "")} onClick={() => setActiveTab(t.id)}>
              {t.icon && <t.icon size={14} />}
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ── LOADING SKELETON ── */}
      {loading && (
        <motion.div className="search-skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
          {(activeTab === "all" || activeTab === "tracks") && (
            <div className="search-section">
              <div className="search-section-head"><div className="sk-sk sk-text" style={{ width: 80 }} /></div>
              {[1, 2, 3, 4, 5].map((i) => <SongSkeleton key={i} />)}
            </div>
          )}
          {(activeTab === "all" || activeTab === "artists") && (
            <div className="search-section">
              <div className="search-section-head"><div className="sk-sk sk-text" style={{ width: 70 }} /></div>
              <div className="search-artists-grid">
                {[1, 2, 3, 4].map((i) => <ArtistSkeleton key={i} />)}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── ERROR STATE ── */}
      {showError && (
        <div className="search-error-state">
          <AlertCircle size={40} strokeWidth={1.2} />
          <p>{error}</p>
          <button type="button" className="search-retry-btn" onClick={() => doSearch(query)}>Thử lại</button>
        </div>
      )}

      {/* ── NO RESULTS ── */}
      {showNoResults && (
        <div className="search-no-results">
          <Search size={40} strokeWidth={1.2} />
          <p>Không tìm thấy kết quả cho "<strong>{query}</strong>"</p>
          <p className="search-no-results-hint">Thử kiểm tra chính tả hoặc dùng từ khóa khác.</p>
        </div>
      )}

      {/* ── RESULTS ── */}
      {showResults && (
        <div className="search-results-body">
          {/* Top Result + Songs side by side on desktop */}
          {(activeTab === "all") && topResult && (
            <div className="search-top-and-songs">
              {/* Top Result */}
              <div className="search-section search-top-section">
                <p className="section-label">KẾT QUẢ HÀNG ĐẦU</p>
                {topResult.type === "artist" ? (
                  <button type="button" className="search-top-card" onClick={() => onOpenArtist && onOpenArtist(topResult.data.username)}>
                    <div className="search-top-art" style={topResult.data.avatarUrl ? { backgroundImage: `url('${topResult.data.avatarUrl}')` } : {}}>
                      {!topResult.data.avatarUrl && <Users size={28} />}
                    </div>
                    <div className="search-top-info">
                      <div className="search-top-name">{topResult.data.artistName}</div>
                      <div className="search-top-meta">
                        <span className={"artist-badge-badge badge-" + (topResult.data.badge === "verified" ? "verified" : "independent")}>
                          {topResult.data.badge === "verified" ? "✓ Nghệ sĩ được 4ANG xác minh" : "Nghệ sĩ trên 4ANG"}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={20} className="search-top-arrow" />
                  </button>
                ) : (
                  <button type="button" className="search-top-card" onClick={() => onPlay(filteredTracks, 0)}>
                    <div className="search-top-art" style={topResult.data.coverUrl ? { backgroundImage: `url('${topResult.data.coverUrl}')` } : { background: gradientFor(hashHue(topResult.data.title)) }}>
                      <div className="search-top-play-overlay">
                        {isPlaying && current?.trackId === topResult.data.id ? <Pause size={20} /> : <Play size={20} fill="white" />}
                      </div>
                    </div>
                    <div className="search-top-info">
                      <div className="search-top-name">{topResult.data.title}</div>
                      <div className="search-top-meta">{topResult.data.composer || topResult.data.artist || "4ANG"}</div>
                    </div>
                  </button>
                )}
              </div>

              {/* Songs */}
              {filteredTracks.length > 0 && (
                <div className="search-section search-songs-section">
                  <p className="section-label">BÀI HÁT</p>
                  <div className="search-tracks-list">
                    {filteredTracks.slice(0, 5).map((t, i) => (
                      <SearchTrackRow
                        key={t.id} track={t} index={i}
                        isCurrent={!!current && current.trackId === t.id}
                        isPlaying={isPlaying}
                        onPlay={() => onPlay(filteredTracks, i)}
                        onLike={() => onLike(t.id)}
                        onOpenArtist={onOpenArtist}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: All (without top result — already shown) */}
          {activeTab === "all" && !topResult && filteredTracks.length > 0 && (
            <div className="search-section">
              <p className="section-label">BÀI HÁT</p>
              <div className="search-tracks-list">
                {filteredTracks.map((t, i) => (
                  <SearchTrackRow key={t.id} track={t} index={i}
                    isCurrent={!!current && current.trackId === t.id} isPlaying={isPlaying}
                    onPlay={() => onPlay(filteredTracks, i)} onLike={() => onLike(t.id)} onOpenArtist={onOpenArtist} />
                ))}
              </div>
            </div>
          )}

          {/* Artists */}
          {(activeTab === "all" || activeTab === "artists") && filteredArtists.length > 0 && (
            <div className="search-section">
              {activeTab === "all" && <p className="section-label">NGHỆ SĨ</p>}
              <div className="search-artists-grid">
                {filteredArtists.map((a) => (
                  <button key={a.username} type="button" className="search-artist-card" onClick={() => onOpenArtist && onOpenArtist(a.username)}>
                    <div className="search-artist-avatar" style={a.avatarUrl ? { backgroundImage: `url('${a.avatarUrl}')` } : {}}>
                      {!a.avatarUrl && <Users size={22} />}
                    </div>
                    <div className="search-artist-name">{a.artistName}</div>
                    <div className="search-artist-badge">
                      {a.badge === "verified" ? "✓ 4ANG Verified" : "Nghệ sĩ"}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Playlists */}
          {(activeTab === "all" || activeTab === "playlists") && filteredPlaylists.length > 0 && (
            <div className="search-section">
              {activeTab === "all" && <p className="section-label">PLAYLIST</p>}
              <div className="search-playlists-grid">
                {filteredPlaylists.map((p) => (
                  <button key={p.id} type="button" className="search-playlist-card" onClick={() => onOpenPlaylist && onOpenPlaylist(p.id)}>
                    <div className="search-playlist-cover">
                      <ListMusic size={22} />
                    </div>
                    <div className="search-playlist-info">
                      <div className="search-playlist-name">{p.title}</div>
                      <div className="search-playlist-meta">{p.trackCount} bài</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* People */}
          {(activeTab === "people" || (activeTab === "all" && filteredPeople.length > 0)) && (
            <div className="search-section">
              {activeTab === "all" && <p className="section-label">MỌI NGƯỜI</p>}
              <div className="search-artists-grid">
                {filteredPeople.map((p) => (
                  <div key={p.id || p.username} className="search-artist-card">
                    <div className="search-artist-avatar" style={p.avatarUrl ? { backgroundImage: `url('${p.avatarUrl}')` } : {}}>
                      {!p.avatarUrl && <Users size={22} />}
                    </div>
                    <div className="search-artist-name">{p.displayName || p.username}</div>
                    <div className="search-artist-badge">@{p.username}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Genres */}
          {(activeTab === "all" || activeTab === "genres") && filteredGenres.length > 0 && (
            <div className="search-section">
              {activeTab === "all" && <p className="section-label">THỂ LOẠI</p>}
              <div className="search-genres-row">
                {filteredGenres.map((g) => (
                  <button key={g.name} type="button" className="search-genre-chip" onClick={() => onOpenGenre && onOpenGenre(g.name)}>
                    <Tag size={14} />
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ── Search Track Row Component ── */
function SearchTrackRow({ track, index, isCurrent, isPlaying, onPlay, onLike, onOpenArtist }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className={"search-track-row" + (isCurrent ? " current" : "")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={onPlay}
    >
      <div className="search-track-num">
        {isCurrent && isPlaying ? (
          <div className="search-track-playing">
            <span /><span /><span />
          </div>
        ) : hovered ? (
          <button type="button" className="search-track-play-btn" onClick={onPlay} aria-label="Phát">
            <Play size={14} fill="currentColor" />
          </button>
        ) : (
          <span className="search-track-index">{index + 1}</span>
        )}
      </div>
      <div className="search-track-art" style={track.coverUrl ? { backgroundImage: `url('${track.coverUrl}')` } : { background: gradientFor(hashHue(track.title)) }} />
      <div className="search-track-info">
        <div className={"search-track-title" + (isCurrent ? " playing" : "")}>{track.title}</div>
        <div className="search-track-artist">
          {track.composer ? (
            <span className="artist-link" onClick={(e) => { e.stopPropagation(); onOpenArtist && onOpenArtist(track.uploaderUsername || track.composer); }}>{track.composer}</span>
          ) : track.artist || "4ANG"}
        </div>
      </div>
      <div className="search-track-actions">
        {isCurrent && isPlaying && <Music size={14} className="search-track-now-playing" />}
        <button type="button" className="search-track-like-btn" onClick={(e) => { e.stopPropagation(); onLike(); }} aria-label="Thích">
          <svg width="16" height="16" viewBox="0 0 24 24" fill={track.likedBy?.length > 0 ? "var(--c-rose)" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        <span className="search-track-duration">{formatTime(track.duration || 0)}</span>
      </div>
    </div>
  );
}
