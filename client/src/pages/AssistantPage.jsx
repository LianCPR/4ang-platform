/**
 * AssistantPage — Phase 3.3
 *
 * AI Music Assistant chat interface.
 * Music-first design with integrated player actions.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Sparkles, Music, Play, Shuffle, Plus, X, Trash2,
  MessageSquare, Clock, ChevronDown, Loader2, ListMusic,
  Disc3, Heart, User
} from "lucide-react";
import { api } from "../api";
import { gradientFor, hashHue } from "../lib/format";

/* ═══════════════════════════════════════════════════════════════════════
 * TRACK CARD — inline music result
 * ═══════════════════════════════════════════════════════════════════════ */

function TrackCard({ track, onPlay, onLike, onAddToQueue }) {
  return (
    <div className="asst-track-card">
      <div
        className="asst-track-art"
        style={track.artwork_url
          ? { backgroundImage: `url(${track.artwork_url})` }
          : { background: gradientFor(hashHue(track.title)) }
        }
        onClick={() => onPlay?.(track)}
      >
        <Play size={16} fill="white" className="asst-track-play-icon" />
      </div>
      <div className="asst-track-info">
        <span className="asst-track-title">{track.title}</span>
        <span className="asst-track-artist">{track.artist_name}</span>
      </div>
      <div className="asst-track-actions">
        {onPlay && (
          <button className="asst-action-sm" onClick={() => onPlay(track)} aria-label="Phát">
            <Play size={14} fill="currentColor" />
          </button>
        )}
        {onLike && (
          <button className="asst-action-sm" onClick={() => onLike(track)} aria-label="Thích">
            <Heart size={14} />
          </button>
        )}
        {onAddToQueue && (
          <button className="asst-action-sm" onClick={() => onAddToQueue(track)} aria-label="Thêm vào hàng đợi">
            <Plus size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * PLAYLIST DRAFT CARD
 * ═══════════════════════════════════════════════════════════════════════ */

function PlaylistDraftCard({ draft, onPlayAll, onSave }) {
  return (
    <div className="asst-playlist-draft">
      <div className="asst-draft-header">
        <ListMusic size={18} />
        <span className="asst-draft-title">{draft.title}</span>
        <span className="asst-draft-count">{draft.tracks?.length || 0} bài</span>
      </div>
      <div className="asst-draft-tracks">
        {(draft.tracks || []).slice(0, 5).map((t, i) => (
          <div key={t.id || i} className="asst-draft-track">
            <span className="asst-draft-num">{i + 1}</span>
            <span className="asst-draft-track-title">{t.title}</span>
            <span className="asst-draft-track-artist">{t.artist_name}</span>
          </div>
        ))}
        {(draft.tracks?.length || 0) > 5 && (
          <div className="asst-draft-more">+{draft.tracks.length - 5} bài khác</div>
        )}
      </div>
      <div className="asst-draft-actions">
        <button className="asst-btn-primary" onClick={() => onPlayAll?.(draft.tracks)}>
          <Play size={14} fill="white" /> Phát tất cả
        </button>
        <button className="asst-btn-secondary" onClick={() => onSave?.(draft)}>
          <Plus size={14} /> Lưu playlist
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * MESSAGE BUBBLE
 * ═══════════════════════════════════════════════════════════════════════ */

function MessageBubble({ msg, onPlayTrack, onLikeTrack, onAddToQueue, onPlayAll, onSavePlaylist }) {
  const isUser = msg.role === "user";

  // Parse metadata for actions
  const metadata = msg.metadata || {};
  const isAssistant = msg.role === "assistant";

  return (
    <motion.div
      className={`asst-message ${isUser ? "asst-user" : "asst-assistant"}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {!isUser && (
        <div className="asst-avatar">
          <Sparkles size={16} />
        </div>
      )}
      <div className="asst-bubble">
        <div className="asst-bubble-text">{msg.content}</div>
        {/* Metadata actions (from assistant response) */}
        {isAssistant && metadata.trackCount > 0 && (
          <div className="asst-bubble-meta">
            <Music size={12} /> {metadata.trackCount} bài hát
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * MAIN ASSISTANT PAGE
 * ═══════════════════════════════════════════════════════════════════════ */

export default function AssistantPage({ session, onPlay, onLike, onAddToQueue, currentTrack }) {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  // Current results from last assistant response
  const [tracks, setTracks] = useState([]);
  const [artists, setArtists] = useState([]);
  const [playlistDraft, setPlaylistDraft] = useState(null);
  const [dailyMixes, setDailyMixes] = useState([]);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const res = await api.assistant?.conversations?.();
      setConversations(res?.conversations || []);
    } catch {
      // Assistant API may not be available yet
    }
  };

  const loadConversationMessages = async (convId) => {
    try {
      const res = await api.assistant?.conversationMessages?.(convId);
      setMessages(res?.messages || []);
      setActiveConvId(convId);
      setTracks([]);
      setArtists([]);
      setPlaylistDraft(null);
      setDailyMixes([]);
      setShowSidebar(false);
    } catch {
      // Fallback
    }
  };

  const startNewConversation = () => {
    setActiveConvId(null);
    setMessages([]);
    setTracks([]);
    setArtists([]);
    setPlaylistDraft(null);
    setDailyMixes([]);
    setShowSidebar(false);
    inputRef.current?.focus();
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setLoading(true);
    setInput("");

    // Add user message immediately
    const userMsg = { role: "user", content: text, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const context = {};
      if (currentTrack) {
        context.currentTrack = {
          id: currentTrack.id,
          title: currentTrack.title,
          artist_name: currentTrack.artist_name,
        };
      }

      const res = await api.assistant?.message?.(text, activeConvId, context);

      if (res?.error) {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.",
          created_at: new Date().toISOString(),
        }]);
      } else {
        // Update conversation ID if new
        if (res.conversationId && res.conversationId !== activeConvId) {
          setActiveConvId(res.conversationId);
          loadConversations();
        }

        // Add assistant response
        const assistantMsg = {
          role: "assistant",
          content: res.response?.text || "Mình chưa hiểu yêu cầu.",
          metadata: {
            intent: res.intent?.intent,
            trackCount: res.toolResults?.tracks?.length || 0,
            actions: res.actions?.map(a => a.type) || [],
          },
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMsg]);

        // Update results
        if (res.toolResults?.tracks?.length) {
          setTracks(res.toolResults.tracks);
        }
        if (res.toolResults?.artists?.length) {
          setArtists(res.toolResults.artists);
        }
        if (res.toolResults?.dailyMixes?.length) {
          setDailyMixes(res.toolResults.dailyMixes);
        }

        // Check for playlist draft action
        const playlistAction = res.actions?.find(a => a.type === "playlist_draft");
        if (playlistAction?.draft) {
          setPlaylistDraft(playlistAction.draft);
        }

        // Check for play action
        const playAction = res.actions?.find(a => a.type === "play_all");
        if (playAction?.tracks?.length && onPlay) {
          onPlay(playAction.tracks, 0);
        }
      }
    } catch (e) {
      console.error("[Assistant]", e);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Trợ lý tạm thời không khả dụng. Bạn có thể thử lại hoặc sử dụng Tìm kiếm.",
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, activeConvId, currentTrack, onPlay]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handlePlayTrack = (track) => {
    if (onPlay && tracks.length > 0) {
      const idx = tracks.findIndex(t => t.id === track.id);
      onPlay(tracks, Math.max(0, idx));
    }
  };

  const handleLikeTrack = (track) => {
    onLike?.(track);
  };

  const handleAddToQueue = (track) => {
    onAddToQueue?.([track]);
  };

  const handlePlayAll = (trackList) => {
    if (onPlay && trackList?.length) {
      onPlay(trackList, 0);
    }
  };

  const handleSavePlaylist = async (draft) => {
    try {
      await api.playlists?.create?.(draft.title, draft.tracks?.map(t => t.id) || []);
      setPlaylistDraft(null);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Đã lưu playlist "${draft.title}" thành công!`,
        created_at: new Date().toISOString(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Không thể lưu playlist. Vui lòng thử lại.",
        created_at: new Date().toISOString(),
      }]);
    }
  };

  const handleDeleteConversation = async (convId) => {
    try {
      await api.assistant?.deleteConversation?.(convId);
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (activeConvId === convId) startNewConversation();
    } catch {
      // Non-critical
    }
  };

  const QUICK_SUGGESTIONS = [
    "Gợi ý nhạc chill để học",
    "Tạo playlist 30 phút để tập",
    "Nhạc giống bài đang phát",
    "Bài tôi đã thích",
    "Khám phá nhạc mới",
  ];

  return (
    <div className="asst-page">
      {/* Sidebar — conversation history */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            className="asst-sidebar"
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="asst-sidebar-header">
              <h3>Đoạn hội thoại</h3>
              <button onClick={() => setShowSidebar(false)} aria-label="Đóng">
                <X size={18} />
              </button>
            </div>
            <button className="asst-new-chat" onClick={startNewConversation}>
              <Plus size={16} /> Cuộc trò chuyện mới
            </button>
            <div className="asst-sidebar-list">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`asst-sidebar-item ${activeConvId === conv.id ? "active" : ""}`}
                  onClick={() => loadConversationMessages(conv.id)}
                >
                  <MessageSquare size={14} />
                  <span className="asst-sidebar-title">{conv.title || "Cuộc trò chuyện mới"}</span>
                  <button
                    className="asst-sidebar-delete"
                    onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
                    aria-label="Xoá"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {conversations.length === 0 && (
                <div className="asst-sidebar-empty">Chưa có cuộc trò chuyện nào</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main chat area */}
      <div className="asst-main">
        {/* Header */}
        <div className="asst-header">
          <button className="asst-sidebar-toggle" onClick={() => setShowSidebar(!showSidebar)} aria-label="Lịch sử">
            <MessageSquare size={18} />
          </button>
          <div className="asst-header-title">
            <Sparkles size={18} />
            <span>Trợ lý âm nhạc</span>
          </div>
          <button className="asst-new-btn" onClick={startNewConversation} aria-label="Mới">
            <Plus size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="asst-messages">
          {messages.length === 0 && (
            <div className="asst-welcome">
              <Sparkles size={40} className="asst-welcome-icon" />
              <h2>Xin chào! 👋</h2>
              <p>Mình là trợ lý âm nhạc của 4ang. Hãy hỏi mình về bất cứ thứ gì liên quan đến nhạc!</p>
              <div className="asst-suggestions">
                {QUICK_SUGGESTIONS.map((s, i) => (
                  <button key={i} className="asst-suggestion" onClick={() => { setInput(s); }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble
              key={i}
              msg={msg}
              onPlayTrack={handlePlayTrack}
              onLikeTrack={handleLikeTrack}
              onAddToQueue={handleAddToQueue}
            />
          ))}

          {loading && (
            <div className="asst-message asst-assistant">
              <div className="asst-avatar"><Sparkles size={16} /></div>
              <div className="asst-bubble asst-typing">
                <Loader2 size={16} className="spin" />
                <span>Đang suy nghĩ...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Results panel — tracks */}
        {tracks.length > 0 && (
          <div className="asst-results-panel">
            <div className="asst-results-header">
              <Music size={14} />
              <span>{tracks.length} bài hát</span>
              <button className="asst-results-close" onClick={() => setTracks([])}>
                <X size={14} />
              </button>
            </div>
            <div className="asst-results-list">
              {tracks.map((track, i) => (
                <TrackCard
                  key={track.id || i}
                  track={track}
                  onPlay={handlePlayTrack}
                  onLike={handleLikeTrack}
                  onAddToQueue={handleAddToQueue}
                />
              ))}
            </div>
          </div>
        )}

        {/* Playlist draft */}
        {playlistDraft && (
          <div className="asst-results-panel">
            <PlaylistDraftCard
              draft={playlistDraft}
              onPlayAll={handlePlayAll}
              onSave={handleSavePlaylist}
            />
          </div>
        )}

        {/* Daily mixes */}
        {dailyMixes.length > 0 && (
          <div className="asst-results-panel">
            <div className="asst-results-header">
              <Disc3 size={14} />
              <span>Daily Mix</span>
            </div>
            <div className="asst-mix-grid">
              {dailyMixes.slice(0, 3).map((mix, i) => (
                <div key={i} className="asst-mix-card" onClick={() => mix.tracks?.length && handlePlayAll(mix.tracks)}>
                  <div className="asst-mix-art">
                    {mix.tracks?.slice(0, 4).map((t, j) => (
                      <div
                        key={j}
                        className="asst-mix-tile"
                        style={t.artwork_url
                          ? { backgroundImage: `url(${t.artwork_url})` }
                          : { background: gradientFor(hashHue(t.title || "")) }
                        }
                      />
                    ))}
                  </div>
                  <div className="asst-mix-info">
                    <span className="asst-mix-title">{mix.title}</span>
                    <span className="asst-mix-desc">{mix.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Artists */}
        {artists.length > 0 && (
          <div className="asst-results-panel">
            <div className="asst-results-header">
              <User size={14} />
              <span>{artists.length} nghệ sĩ</span>
            </div>
            <div className="asst-artist-list">
              {artists.map((artist, i) => (
                <div key={artist.id || i} className="asst-artist-card">
                  <div
                    className="asst-artist-avatar"
                    style={artist.avatar_url
                      ? { backgroundImage: `url(${artist.avatar_url})` }
                      : { background: gradientFor(hashHue(artist.artist_name)) }
                    }
                  />
                  <div className="asst-artist-info">
                    <span className="asst-artist-name">{artist.artist_name}</span>
                    <span className="asst-artist-genre">{artist.genre || ""}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="asst-input-area">
          <div className="asst-input-bar">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Hỏi về nhạc..."
              className="asst-input"
              disabled={loading}
            />
            <button
              className="asst-send-btn"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              aria-label="Gửi"
            >
              {loading ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
            </button>
          </div>
          <div className="asst-input-hint">
            Nhấn Enter để gửi · Shift+Enter xuống dòng
          </div>
        </div>
      </div>
    </div>
  );
}
