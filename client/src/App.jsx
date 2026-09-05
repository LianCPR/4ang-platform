import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { api, audioSrcFor, getToken, setToken } from "./api";
import { lsGet, lsSet } from "./storage";
import { supabase, isSupabaseConfigured, getSupabaseToken } from "./lib/supabase";
import { hashHue } from "./lib/format";
import { panelVariants } from "./lib/motion";
import { resolveAmbient, applyAmbient } from "./lib/ambient";

import { lazy, Suspense } from "react";
import LoadingScreen from "./components/LoadingScreen";
import AuthPage from "./pages/AuthPage";
import Toast from "./components/Toast";
import TopBar from "./components/TopBar";
import SideNav from "./components/SideNav";
import LeftSidebar from "./components/LeftSidebar";
import RightPanel from "./components/RightPanel";
import BottomNav from "./components/BottomNav";
import MiniPlayer from "./components/MiniPlayer";
import FullPlayer from "./components/FullPlayer";
import Sheet from "./components/Sheet";
import CommentsPanel from "./components/CommentsPanel";
import LyricsPanel from "./components/LyricsPanel";
import QueuePanel from "./components/QueuePanel";
import AddToPlaylistSheet from "./components/AddToPlaylistSheet";
import CreatePlaylistSheet from "./components/CreatePlaylistSheet";
import ShareSheet from "./components/ShareSheet";

// Lazy-loaded page components for code splitting
const HomePage = lazy(() => import("./pages/HomePage"));
const DiscoverPage = lazy(() => import("./pages/DiscoverPage"));
const SavedPage = lazy(() => import("./pages/SavedPage"));
const LibraryPage = lazy(() => import("./pages/LibraryPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const ArtistProfilePage = lazy(() => import("./pages/ArtistProfilePage"));
const ArtistDashboardPage = lazy(() => import("./pages/ArtistDashboardPage"));
const SubmitMusicPage = lazy(() => import("./pages/SubmitMusicPage"));
const PlaylistDetailPage = lazy(() => import("./pages/PlaylistDetailPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
import ArtistProfileForm from "./components/ArtistProfileForm";
const BecomeArtistPage = lazy(() => import("./pages/BecomeArtistPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const ExplorePage = lazy(() => import("./pages/ExplorePage"));
const ListeningStatsPage = lazy(() => import("./pages/ListeningStatsPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const AccessDeniedPage = lazy(() => import("./pages/AccessDeniedPage"));
import SmartMixRail from "./components/SmartMixRail";
import OnboardingPage from "./pages/OnboardingPage";

import "./styles/index.css";

export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);


  const [activeTab, setActiveTab] = useState("home");
  const [tracks, setTracks] = useState([]);
  const [tracksReady, setTracksReady] = useState(false);
  const [myTracksState, setMyTracksState] = useState([]);
  const [toast, setToast] = useState("");

  const [submitMusicOpen, setSubmitMusicOpen] = useState(false);
  const [submitMusicEditingId, setSubmitMusicEditingId] = useState(null);
  const [submissionsRefreshKey, setSubmissionsRefreshKey] = useState(0);

  const [sheet, setSheet] = useState(null);
  const [commentDraft, setCommentDraft] = useState("");

  const [myArtist, setMyArtist] = useState(null);
  const [followedUsernames, setFollowedUsernames] = useState([]);
  const [becomeArtistOpen, setBecomeArtistOpen] = useState(false);
  const [viewingArtist, setViewingArtist] = useState(null);


  const [current, setCurrent] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [npOpen, setNpOpen] = useState(false);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [progress, setProgress] = useState({ cur: 0, dur: 0 });
  const [volume, setVolume] = useState(() => lsGet("player_volume", 80));
  const [shuffleEnabled, setShuffleEnabled] = useState(() => lsGet("player_shuffle", false));
  const [repeatMode, setRepeatMode] = useState(() => lsGet("player_repeat", "off")); // off | all | one
  const [playbackHistory, setPlaybackHistory] = useState([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState(() => lsGet("recently_played", []));
  const [continueListeningTracks, setContinueListeningTracks] = useState([]);
  const [shuffleOrder, setShuffleOrder] = useState([]);
  const shuffledQueueRef = useRef([]);
  const sleepTimerRef = useRef(null);
  const savedPositionRef = useRef(null);
  const [crossfadeDuration, setCrossfadeDuration] = useState(() => lsGet("player_crossfade", 0));
  const [audioState, setAudioState] = useState("idle"); // idle | loading | playing | paused | buffering | ended | error
  const [audioError, setAudioError] = useState(null);
  const audioRetryRef = useRef(0);

  // Phase 8 new state
  const [viewingPlaylist, setViewingPlaylist] = useState(null);
  const [viewingGenre, setViewingGenre] = useState(null);
  const [addToPlaylistTrackId, setAddToPlaylistTrackId] = useState(null);
  const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [sleepTimer, setSleepTimer] = useState(null); // null = off, number = minutes
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(null);

  // Deep linking
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const deepLinkResolved = useRef(false);

  const audioRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const ytApiPromiseRef = useRef(null);
  const ytContainerRef = useRef(null);

  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(""), 2800); }, []);

  const allKnownTracks = [...tracks, ...myTracksState];
  const currentLocalTrack = current && current.source === "local" ? allKnownTracks.find((t) => t.id === current.trackId) : null;

  /* ---- initial load: Supabase session first, then legacy JWT ---- */
  useEffect(() => {
    (async () => {
      let restored = false;

      // 1) Try Supabase session restoration (persistSession: true stores in localStorage)
      if (isSupabaseConfigured) {
        try {
          const { data: { session: supaSession } } = await supabase.auth.getSession();
          if (supaSession?.access_token) {
            // Sync profile with backend to get backend JWT
            const syncResult = await api.syncProfile(supaSession.access_token);
            setToken(syncResult.token);
            setSession(syncResult.user);
            restored = true;
          }
        } catch (e) {
          // Supabase session expired or invalid — try legacy token
        }
      }

      // 2) Fallback: legacy backend JWT
      if (!restored) {
        const token = getToken();
        if (token) {
          try {
            const { user } = await api.me();
            setSession(user);
            restored = true;
          } catch (e) {
            setToken(null);
          }
        }
      }

      setAuthReady(true);
      try {
        const { tracks: list } = await api.publicTracks();
        setTracks(list);
      } catch (e) { /* feed load failed, leave empty */ }
      setTracksReady(true);
    })();
  }, []);

  // Deep link resolution — read URL path + params on mount
  useEffect(() => {
    if (deepLinkResolved.current) return;
    const path = location.pathname;
    const artist = searchParams.get("artist");
    const track = searchParams.get("play");
    const playlist = searchParams.get("playlist");
    const album = searchParams.get("album");
    const q = searchParams.get("q");

    // Path-based deep links: /artist/:id, /playlist/:id, /track/:id
    const pathArtist = path.match(/^\/artist\/([^/]+)/);
    const pathPlaylist = path.match(/^\/playlist\/(\d+)/);
    const pathTrack = path.match(/^\/track\/(\d+)/);

    if (pathArtist) { setViewingArtist(pathArtist[1]); setActiveTab("artist"); }
    else if (pathPlaylist) { setViewingPlaylist(parseInt(pathPlaylist[1])); }
    else if (pathTrack) { /* will be resolved after tracks load */ }
    else if (artist) { setViewingArtist(artist); setActiveTab("artist"); }
    else if (playlist) { setViewingPlaylist(playlist); }
    else if (track) { /* will be resolved after tracks load */ }
    else if (q) { setActiveTab("search"); }

    deepLinkResolved.current = true;
  }, [searchParams, location.pathname, authReady]);

  // Centralized navigation helpers with URL sync
  function goTab(tab) { setActiveTab(tab); syncUrl(tab); }
  function goArtist(username) { setViewingArtist(username); setActiveTab("artist"); syncUrl("artist", { artist: username }); }
  function goPlaylist(id) { setViewingPlaylist(id); syncUrl("playlist", { playlist: id }); }
  function syncUrl(tab, extras) {
    let urlPath = "/";
    if (extras?.artist) urlPath = "/artist/" + encodeURIComponent(extras.artist);
    else if (extras?.playlist) urlPath = "/playlist/" + extras.playlist;
    else if (extras?.track) urlPath = "/track/" + extras.track;
    else if (extras?.q) urlPath = "/search?q=" + encodeURIComponent(extras.q);
    window.history.replaceState(null, "", urlPath);
  }

  // Poll notification count
  useEffect(() => {
    if (!session) { setUnreadNotifCount(0); return; }
    let cancelled = false;
    function poll() {
      if (cancelled) return;
      api.unreadNotificationCount().then((res) => {
        if (!cancelled) setUnreadNotifCount(res.count || 0);
      }).catch(() => {});
    }
    poll();
    const id = setInterval(poll, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, [session]);

  async function refreshTracks() {
    try { const { tracks: list } = await api.publicTracks(); setTracks(list); } catch (e) { /* ignore */ }
  }
  async function refreshMine() {
    try { const { tracks: list } = await api.myTracks(); setMyTracksState(list); } catch (e) { /* ignore */ }
  }
  function refreshMyArtist() {
    return api.myArtistProfile().then((res) => setMyArtist(res.artist)).catch(() => setMyArtist(null));
  }

  useEffect(() => {
    if (session) refreshMyArtist(); else setMyArtist(null);
    if (session) {
      api.myFollowing().then((res) => setFollowedUsernames(res.usernames)).catch(() => setFollowedUsernames([]));
    } else {
      setFollowedUsernames([]);
    }
  }, [session]);

  useEffect(() => {
    if (activeTab === "profile" && session) {
      refreshMine();
    }
    if (activeTab === "home" && session) {
      api.myFollowing().then((res) => setFollowedUsernames(res.usernames)).catch(() => {});
      api.continueListening(10).then((res) => setContinueListeningTracks(res.tracks || [])).catch(() => {});
    }
  }, [activeTab, session]);

  function mergeTrackIntoLists(updated) {
    setTracks((list) => list.map((t) => (t.id === updated.id ? updated : t)));
    setMyTracksState((list) => list.map((t) => (t.id === updated.id ? updated : t)));
  }

  /* ---- auth ---- */
  function applyAuthResult(result) {
    setToken(result.token);
    setSession(result.user);
    refreshTracks();
  }

  function handleLogout() {
    setToken(null);
    setSession(null);
    setMyTracksState([]);
    setActiveTab("home");
    // Sign out from Supabase so the session is cleared across refreshes
    if (isSupabaseConfigured) {
      supabase.auth.signOut().catch(() => {});
    }
  }

  /* ---- submit music (Phase 6) ---- */
  function openUpload() {
    if (!session) { showToast("Vui lòng đăng nhập trước."); return; }
    if (!myArtist) { setActiveTab("become-artist"); return; }
    setSubmitMusicEditingId(null);
    setSubmitMusicOpen(true);
  }
  function openSubmitMusic(id) {
    setSubmitMusicEditingId(id || null);
    setSubmitMusicOpen(true);
  }
  function closeSubmitMusic() {
    setSubmitMusicOpen(false);
    setSubmitMusicEditingId(null);
    setSubmissionsRefreshKey((k) => k + 1);
  }

  /* ---- like / save / share / comment ---- */
  async function toggleLike(trackId) {
    if (!session) { showToast("Đăng nhập để thả tym."); return; }
    try { const { track } = await api.like(trackId); mergeTrackIntoLists(track); } catch (e) { showToast(e.message); }
  }
  async function toggleSave(trackId) {
    if (!session) { showToast("Đăng nhập để lưu bài hát."); return; }
    try { const { track } = await api.save(trackId); mergeTrackIntoLists(track); } catch (e) { showToast(e.message); }
  }
  const [shareOpen, setShareOpen] = useState(false);
  const [shareData, setShareData] = useState({ type: "track", id: null, title: "", artist: "", coverUrl: "" });

  function openShare(type, data) {
    setShareData({ type, id: data.id, title: data.title || "", artist: data.artist || data.artistName || "", coverUrl: data.coverUrl || "" });
    setShareOpen(true);
    if (type === "track" && data.id) {
      api.share(data.id).then(({ track }) => mergeTrackIntoLists(track)).catch(() => {});
    }
  }
  function handleShare(track) { openShare("track", track); }
  async function submitComment(trackId) {
    if (!session) { showToast("Đăng nhập để bình luận."); return; }
    const text = commentDraft.trim();
    if (!text) return;
    try {
      const { track } = await api.comment(trackId, text);
      mergeTrackIntoLists(track);
      setCommentDraft("");
    } catch (e) { showToast(e.message); }
  }

  /* ---- playback ---- */
  function playTrackAtIndex(list, index) {
    const t = list[index];
    if (!t) return;
    if (t.__isYT) playYouTube(t, list, index); else playServerTrack(t, list, index);
  }
  function playServerTrack(track, list, index) {
    if (ytPlayerRef.current && ytPlayerRef.current.pauseVideo) ytPlayerRef.current.pauseVideo();
    // Push current track to playback history
    if (current && current.trackId) {
      setPlaybackHistory((h) => [...h, current.trackId].slice(-50));
    }
    const audio = audioRef.current;
    const startPos = savedPositionRef.current || 0;
    savedPositionRef.current = null;
    const doSwitch = () => {
      audio.src = audioSrcFor(track);
      audio.currentTime = startPos;
      audio.volume = volume / 100;
      audio.play();
      setQueue(list); setQueueIndex(index);
      setCurrent({
        trackId: track.id, title: track.title,
        artist: (track.credits && track.credits[0] && track.credits[0].artistName) || track.composer || track.uploaderDisplayName,
        hue: hashHue(track.title), thumb: track.coverUrl || null, source: "local",
      });
      setRecentlyPlayed((ids) => {
        const next = [track.id, ...ids.filter((id) => id !== track.id)].slice(0, 12);
        lsSet("recently_played", next);
        return next;
      });
      if (shuffleEnabled && list.length > 1) {
        const indices = list.map((_, i) => i).filter((i) => i !== index);
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        indices.unshift(index);
        setShuffleOrder(indices);
        shuffledQueueRef.current = indices;
      }
      api.play(track.id).then(({ track: updated }) => mergeTrackIntoLists(updated)).catch(() => {});
    };
    // Crossfade: fade out current → switch source → fade in
    if (crossfadeDuration > 0 && !audio.paused && audio.currentTime > 0) {
      const fadeMs = Math.min(crossfadeDuration * 1000, 8000);
      const steps = 20;
      const stepMs = fadeMs / steps;
      const startVol = audio.volume;
      let step = 0;
      const fadeOut = setInterval(() => {
        step++;
        audio.volume = startVol * (1 - step / steps);
        if (step >= steps) {
          clearInterval(fadeOut);
          doSwitch();
          // Fade in
          const targetVol = volume / 100;
          audio.volume = 0;
          let fadeInStep = 0;
          const fadeIn = setInterval(() => {
            fadeInStep++;
            audio.volume = targetVol * (fadeInStep / steps);
            if (fadeInStep >= steps) { clearInterval(fadeIn); audio.volume = targetVol; }
          }, stepMs);
        }
      }, stepMs);
    } else {
      doSwitch();
    }
  }
  function loadYTAPI() {
    if (ytApiPromiseRef.current) return ytApiPromiseRef.current;
    ytApiPromiseRef.current = new Promise((resolve) => {
      if (window.YT && window.YT.Player) { resolve(); return; }
      window.onYouTubeIframeAPIReady = () => resolve();
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    });
    return ytApiPromiseRef.current;
  }
  function ensureYTPlayer() {
    return loadYTAPI().then(() => {
      if (ytPlayerRef.current) return ytPlayerRef.current;
      return new Promise((resolve) => {
        ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
          height: "0", width: "0", playerVars: { playsinline: 1 },
          events: { onReady: () => resolve(ytPlayerRef.current), onStateChange: onYTStateChange }
        });
      });
    });
  }
  function onYTStateChange(e) {
    if (e.data === window.YT.PlayerState.ENDED) handleNext();
    else if (e.data === window.YT.PlayerState.PLAYING) setIsPlaying(true);
    else if (e.data === window.YT.PlayerState.PAUSED) setIsPlaying(false);
  }
  async function playYouTube(item, list, index) {
    if (audioRef.current) audioRef.current.pause();
    const player = await ensureYTPlayer();
    player.loadVideoById(item.id);
    player.setVolume(volume);
    setQueue(list); setQueueIndex(index);
    setCurrent({ trackId: item.id, title: item.title, artist: item.artist, thumb: item.thumb, source: "yt" });
  }
  function togglePlayPause() {
    if (!current) return;
    if (current.source === "local") {
      const a = audioRef.current;
      if (a.paused) a.play(); else a.pause();
    } else if (current.source === "yt" && ytPlayerRef.current) {
      const s = ytPlayerRef.current.getPlayerState();
      if (s === 1) ytPlayerRef.current.pauseVideo(); else ytPlayerRef.current.playVideo();
    }
  }
  function handleNext() {
    if (!queue.length) return;
    if (repeatMode === "one") {
      // Replay current track
      playTrackAtIndex(queue, queueIndex);
      return;
    }
    if (shuffleEnabled && shuffledQueueRef.current.length > 0) {
      const posInShuffle = shuffledQueueRef.current.indexOf(queueIndex);
      if (posInShuffle < shuffledQueueRef.current.length - 1) {
        playTrackAtIndex(queue, shuffledQueueRef.current[posInShuffle + 1]);
      } else if (repeatMode === "all") {
        playTrackAtIndex(queue, shuffledQueueRef.current[0]);
      } else {
        setIsPlaying(false);
      }
    } else {
      const nextIndex = queueIndex + 1;
      if (nextIndex < queue.length) {
        playTrackAtIndex(queue, nextIndex);
      } else if (repeatMode === "all") {
        playTrackAtIndex(queue, 0);
      } else {
        setIsPlaying(false);
      }
    }
  }
  function handlePrev() {
    if (!queue.length) return;
    // If more than 3 seconds into track, restart it
    if (progress.cur > 3) {
      if (current.source === "local") audioRef.current.currentTime = 0;
      else if (ytPlayerRef.current) ytPlayerRef.current.seekTo(0, true);
      return;
    }
    if (shuffleEnabled && playbackHistory.length > 0) {
      const prevTrackId = playbackHistory[playbackHistory.length - 1];
      const prevIndex = queue.findIndex((t) => t.id === prevTrackId);
      if (prevIndex >= 0) {
        setPlaybackHistory((h) => h.slice(0, -1));
        playTrackAtIndex(queue, prevIndex);
        return;
      }
    }
    if (queueIndex > 0) playTrackAtIndex(queue, queueIndex - 1);
    else if (repeatMode === "all") playTrackAtIndex(queue, queue.length - 1);
  }
  function removeFromQueue(index) {
    if (index === queueIndex) return;
    setQueue((q) => q.filter((_, i) => i !== index));
    setQueueIndex((qi) => (index < qi ? qi - 1 : qi));
  }
  function clearUpcoming() {
    setQueue((q) => q.slice(0, queueIndex + 1));
  }
  function handleSeek(val) {
    if (!current) return;
    const target = (val / 1000) * progress.dur;
    if (current.source === "local") audioRef.current.currentTime = target;
    else if (ytPlayerRef.current) ytPlayerRef.current.seekTo(target, true);
  }
  function handleVolume(v) {
    setVolume(v);
    lsSet("player_volume", v);
    if (audioRef.current) audioRef.current.volume = v / 100;
    if (ytPlayerRef.current && ytPlayerRef.current.setVolume) ytPlayerRef.current.setVolume(v);
  }
  function toggleShuffle() {
    const next = !shuffleEnabled;
    setShuffleEnabled(next);
    lsSet("player_shuffle", next);
    if (next && queue.length > 1) {
      // Generate shuffled order preserving current track
      const indices = queue.map((_, i) => i).filter((i) => i !== queueIndex);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      indices.unshift(queueIndex);
      setShuffleOrder(indices);
      shuffledQueueRef.current = indices;
    } else {
      setShuffleOrder([]);
      shuffledQueueRef.current = [];
    }
  }
  function toggleRepeat() {
    const modes = ["off", "all", "one"];
    const next = modes[(modes.indexOf(repeatMode) + 1) % modes.length];
    setRepeatMode(next);
    lsSet("player_repeat", next);
  }
  function handleSetCrossfade(v) {
    setCrossfadeDuration(v);
    lsSet("player_crossfade", v);
  }
  function toggleMute() {
    if (volume > 0) {
      lsSet("player_volume_before_mute", volume);
      handleVolume(0);
    } else {
      handleVolume(lsGet("player_volume_before_mute", 80));
    }
  }
  function likeCurrentTrack() {
    if (current && current.trackId) toggleLike(current.trackId);
  }
  function playNext(track) {
    if (!track) return;
    const nextIndex = queueIndex + 1;
    setQueue((q) => [...q.slice(0, nextIndex), track, ...q.slice(nextIndex)]);
    showToast("Sẽ phát tiếp: " + track.title);
  }
  function addToQueue(track) {
    if (!track) return;
    setQueue((q) => [...q, track]);
    showToast("Đã thêm vào hàng chờ.");
  }
  async function startRadio(track) {
    if (!track) return;
    try {
      const res = await api.radio(track.id, 20);
      if (res.tracks && res.tracks.length > 0) {
        setQueue(res.tracks);
        setQueueIndex(0);
        playTrackAtIndex(res.tracks, 0);
        showToast("Đang phát radio: " + track.title);
      }
    } catch (e) {
      showToast("Không thể tạo radio.");
    }
  }
  async function moreLikeThis(track) {
    if (!track) return;
    try {
      const res = await api.moreLikeThis(track.id, 12);
      if (res.tracks && res.tracks.length > 0) {
        const newQueue = [track, ...res.tracks];
        setQueue(newQueue);
        setQueueIndex(0);
        playTrackAtIndex(newQueue, 0);
        showToast("Phát bài tương tự: " + track.title);
      }
    } catch (e) {
      showToast("Không thể tìm bài tương tự.");
    }
  }
  function retryAudio() {
    const a = audioRef.current;
    if (!a || !current) return;
    if (audioRetryRef.current >= 3) {
      setAudioError("Bài hát không thể phát. Bỏ qua để nghe bài tiếp.");
      setTimeout(() => handleNext(), 2000);
      return;
    }
    audioRetryRef.current++;
    setAudioState("loading");
    setAudioError(null);
    const src = a.src;
    a.src = "";
    setTimeout(() => { a.src = src; a.load(); a.play().catch(() => {}); }, 100);
  }

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    function onPlay() { setIsPlaying(true); setAudioState("playing"); setAudioError(null); audioRetryRef.current = 0; }
    function onPause() { setIsPlaying(false); if (!a.ended) setAudioState("paused"); }
    function onEnded() { setAudioState("ended"); handleNext(); }
    function onWaiting() { setAudioState("buffering"); }
    function onCanPlay() { setAudioState(a.paused ? "paused" : "playing"); }
    function onError() {
      const mediaError = a.error;
      const msg = mediaError ? (mediaError.code === 4 ? "Bài hát không khả dụng." : mediaError.code === 3 ? "Lỗi解码 audio." : "Không thể phát bài hát.") : "Lỗi audio.";
      setAudioState("error");
      setAudioError(msg);
    }
    function onStall() { setAudioState("buffering"); }
    let lastUpdate = 0;
    function onTime() {
      const now = performance.now();
      if (now - lastUpdate < 250) return;
      lastUpdate = now;
      setProgress({ cur: a.currentTime || 0, dur: a.duration || 0 });
    }
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    a.addEventListener("waiting", onWaiting);
    a.addEventListener("canplay", onCanPlay);
    a.addEventListener("error", onError);
    a.addEventListener("stalled", onStall);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onTime);
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("waiting", onWaiting);
      a.removeEventListener("canplay", onCanPlay);
      a.removeEventListener("error", onError);
      a.removeEventListener("stalled", onStall);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onTime);
    };
  }, [queue, queueIndex]);

  useEffect(() => {
    const id = setInterval(() => {
      if (current && current.source === "yt" && ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
        setProgress({ cur: ytPlayerRef.current.getCurrentTime() || 0, dur: ytPlayerRef.current.getDuration() || 0 });
      }
    }, 500);
    return () => clearInterval(id);
  }, [current]);

  /* ---- throttled progress save (continue listening) ---- */
  const lastProgressSaveRef = useRef(0);
  useEffect(() => {
    if (!current || current.source !== "local") return;
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastProgressSaveRef.current < 15000) return; // throttle: max once per 15s
      lastProgressSaveRef.current = now;
      if (progress.cur > 5 && progress.dur > 10) {
        api.saveProgress(current.trackId, progress.cur, progress.dur).catch(() => {});
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [current?.trackId]);
  // Save on track change too
  useEffect(() => {
    return () => {
      if (current && progress.cur > 5 && progress.dur > 10) {
        api.saveProgress(current.trackId, progress.cur, progress.dur).catch(() => {});
      }
    };
  }, [current?.trackId]);

  useEffect(() => {
    let cancelled = false;
    resolveAmbient(current).then((pair) => { if (!cancelled) applyAmbient(pair); });
    return () => { cancelled = true; };
  }, [current?.trackId]);

  /* ---- Playback persistence: save state to localStorage ---- */
  useEffect(() => {
    if (!current) return;
    lsSet("player_current", { trackId: current.trackId, title: current.title, artist: current.artist, hue: current.hue, thumb: current.thumb, source: current.source });
    lsSet("player_queue_ids", queue.map((t) => t.id));
    lsSet("player_queue_index", queueIndex);
  }, [current, queue, queueIndex]);
  useEffect(() => {
    if (progress.cur > 0 && progress.dur > 5 && current) {
      lsSet("player_position", { trackId: current.trackId, position: progress.cur });
    }
  }, [progress.cur]);

  /* ---- Playback persistence: restore on mount ---- */
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || !tracksReady || tracks.length === 0) return;
    restoredRef.current = true;
    const saved = lsGet("player_current");
    const savedQueueIds = lsGet("player_queue_ids", []);
    const savedIndex = lsGet("player_queue_index", 0);
    const savedPos = lsGet("player_position");
    if (!saved || !saved.trackId) return;
    // Find the current track in allKnownTracks
    const allTracks = [...tracks];
    const trackObj = allTracks.find((t) => t.id === saved.trackId);
    if (!trackObj) return;
    // Restore queue: look up track objects by saved IDs
    let restoredQueue = savedQueueIds.map((id) => allTracks.find((t) => t.id === id)).filter(Boolean);
    if (restoredQueue.length === 0) restoredQueue = [trackObj];
    // Ensure saved track is in queue
    if (!restoredQueue.find((t) => t.id === saved.trackId)) {
      restoredQueue.unshift(trackObj);
    }
    const restoredIndex = Math.min(savedIndex, restoredQueue.length - 1);
    // Set state
    setCurrent(saved);
    setQueue(restoredQueue);
    setQueueIndex(restoredIndex);
    if (savedPos && savedPos.trackId === saved.trackId && savedPos.position > 0) {
      savedPositionRef.current = savedPos.position;
    }
    // Start playback after a tick so audio element is ready
    setTimeout(() => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.src = audioSrcFor(trackObj);
      audio.volume = volume / 100;
      audio.currentTime = savedPos && savedPos.trackId === saved.trackId ? savedPos.position : 0;
      audio.play().catch(() => {});
      setIsPlaying(true);
    }, 100);
  }, [tracksReady, tracks.length]);

  /* Media Session API — system-level now-playing controls */
  useEffect(() => {
    if (!("mediaSession" in navigator) || !current) return;
    const track = currentLocalTrack;
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: current.title || "",
      artist: current.artist || "",
      album: "4ANG",
      artwork: current.thumb ? [{ src: current.thumb, sizes: "512x512", type: "image/jpeg" }] : [],
    });
    navigator.mediaSession.setActionHandler("play", () => { if (audioRef.current) audioRef.current.play(); });
    navigator.mediaSession.setActionHandler("pause", () => { if (audioRef.current) audioRef.current.pause(); });
    navigator.mediaSession.setActionHandler("previoustrack", handlePrev);
    navigator.mediaSession.setActionHandler("nexttrack", handleNext);
    navigator.mediaSession.setActionHandler("seekbackward", (e) => {
      const offset = e.seekOffset || 10;
      if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - offset);
    });
    navigator.mediaSession.setActionHandler("seekforward", (e) => {
      const offset = e.seekOffset || 10;
      if (audioRef.current) audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + offset);
    });
    navigator.mediaSession.setActionHandler("seekto", (e) => {
      if (e.seekTime != null && audioRef.current) audioRef.current.currentTime = e.seekTime;
    });
    return () => {
      try {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("seekbackward", null);
        navigator.mediaSession.setActionHandler("seekforward", null);
        navigator.mediaSession.setActionHandler("seekto", null);
      } catch { /* ignore */ }
    };
  }, [current?.trackId, currentLocalTrack, isPlaying]);

  /* Dynamic page title */
  useEffect(() => {
    const tabTitles = {
      home: "4ANG — Nghe nhạc",
      discover: "4ANG — Khám phá",
      search: "4ANG — Tìm kiếm",
      library: "4ANG — Thư viện",
      notifications: "4ANG — Thông báo",
      profile: "4ANG — Hồ sơ",
    };
    let title = tabTitles[activeTab] || "4ANG";
    if (activeTab === "artist" && viewingArtist) title = viewingArtist + " — 4ANG";
    if (activeTab === "playlist" && viewingPlaylist) title = "Playlist — 4ANG";
    if (current && isPlaying) title = "▶ " + (current.title || "") + " — " + (current.artist || "") + " | 4ANG";
    document.title = title;
    // Update og meta tags for deep links
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogTitle) ogTitle.setAttribute("content", title);
    if (ogDesc) ogDesc.setAttribute("content", title.includes("—") ? title.replace(" | 4ANG", "") : "4ANG — nền tảng nghe nhạc lãng mạn");
  }, [activeTab, viewingArtist, viewingPlaylist, current, isPlaying]);

  // Sleep Timer
  const startSleepTimer = useCallback((minutes) => {
    clearSleepTimer();
    if (!minutes) { setSleepTimer(null); setSleepTimerRemaining(null); return; }
    setSleepTimer(minutes);
    const endTime = Date.now() + minutes * 60 * 1000;
    setSleepTimerRemaining(minutes * 60);
    sleepTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setSleepTimerRemaining(remaining);
      if (remaining <= 0) {
        clearSleepTimer();
        togglePlayPause();
      }
    }, 1000);
  }, [togglePlayPause]);
  const clearSleepTimer = useCallback(() => {
    if (sleepTimerRef.current) { clearInterval(sleepTimerRef.current); sleepTimerRef.current = null; }
    setSleepTimer(null);
    setSleepTimerRemaining(null);
  }, []);
  useEffect(() => () => { if (sleepTimerRef.current) clearInterval(sleepTimerRef.current); }, []);

  const trending = useMemo(() => {
    return tracks
      .map((t) => ({ t, score: t.likedBy.length * 2 + t.shareCount * 3 + (t.playCount || 0) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((x) => x.t);
  }, [tracks]);

  /* ---- keyboard shortcuts ---- */
  useEffect(() => {
    function onKey(e) {
      // Don't capture when typing in inputs
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target.isContentEditable) return;
      switch (e.code) {
        case "Space":
          if (current) { e.preventDefault(); togglePlayPause(); }
          break;
        case "ArrowRight":
          if (current && e.shiftKey) { e.preventDefault(); handleNext(); }
          else if (current) { e.preventDefault(); handleSeek(Math.min(1000, Math.round((progress.cur + 10) / Math.max(progress.dur, 1) * 1000))); }
          break;
        case "ArrowLeft":
          if (current && e.shiftKey) { e.preventDefault(); handlePrev(); }
          else if (current) { e.preventDefault(); handleSeek(Math.max(0, Math.round((progress.cur - 10) / Math.max(progress.dur, 1) * 1000))); }
          break;
        case "ArrowUp":
          e.preventDefault(); handleVolume(Math.min(100, volume + 5));
          break;
        case "ArrowDown":
          e.preventDefault(); handleVolume(Math.max(0, volume - 5));
          break;
        case "KeyM":
          e.preventDefault(); toggleMute();
          break;
        case "KeyL":
          e.preventDefault(); likeCurrentTrack();
          break;
        case "KeyS":
          e.preventDefault(); toggleShuffle();
          break;
        case "KeyN":
          if (current) { e.preventDefault(); handleNext(); }
          break;
        case "KeyP":
          if (current) { e.preventDefault(); handlePrev(); }
          break;
        default:
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, togglePlayPause, volume]);

  if (!authReady || !tracksReady) {
    return <LoadingScreen />;
  }

  // Fallback for lazy-loaded pages
  const pageFallback = <div style={{ padding: 'var(--sp-8)', textAlign: 'center', color: 'var(--text-faint)' }}><LoadingScreen /></div>;

  // Check if URL is a deep link to public content
  const pathArtist = location.pathname.match(/^\/artist\/([^/]+)/);
  const pathPlaylist = location.pathname.match(/^\/playlist\/(\d+)/);
  const pathTrack = location.pathname.match(/^\/track\/(\d+)/);
  const isPublicDeepLink = !!(pathArtist || pathPlaylist || pathTrack);

  if (!session) {
    // Public deep links: show content with login prompt
    if (isPublicDeepLink) {
      return (
        <>
          <div className="atmosphere atmosphere-grain" />
          <div className="atmosphere atmosphere-vignette" />
          <div className="atmosphere atmosphere-glow" />
          <div className="public-deep-link-banner">
            <span>Đăng nhập để trải nghiệm đầy đủ 4ANG</span>
            <button className="btn-primary" onClick={() => setActiveTab("_auth")}>Đăng nhập</button>
          </div>
          <div className="app-layout">
            <main className="app-content" style={{ paddingTop: 56 }}>
              <Suspense fallback={<div style={{ padding: 'var(--sp-8)', textAlign: 'center', color: 'var(--text-faint)' }}><LoadingScreen /></div>}>
                {pathArtist && (
                  <ArtistProfilePage
                    username={pathArtist[1]} session={null}
                    onBack={() => window.history.back()}
                    current={current} isPlaying={isPlaying} progress={progress}
                    onPlay={playTrackAtIndex} onLike={() => {}} onSave={() => {}}
                    onShare={() => {}} onComment={() => {}} onLyrics={() => {}}
                    onOpenArtist={(u) => window.location.href = "/artist/" + u}
                    onShareArtist={() => {}}
                  />
                )}
                {pathPlaylist && (
                  <PlaylistDetailPage
                    playlistId={parseInt(pathPlaylist[1])} session={null}
                    onClose={() => window.history.back()}
                    onPlay={playTrackAtIndex} onLike={() => {}} onSave={() => {}}
                    onShare={() => {}} onComment={() => {}} onLyrics={() => {}}
                    onAddToPlaylist={() => {}} onOpenArtist={(u) => window.location.href = "/artist/" + u}
                    showToast={() => {}}
                  />
                )}
              </Suspense>
            </main>
          </div>
        </>
      );
    }
    return (
      <>
        <div className="atmosphere atmosphere-grain" />
        <div className="atmosphere atmosphere-vignette" />
        <div className="atmosphere atmosphere-glow" />
        <AuthPage onAuthSuccess={applyAuthResult} />
      </>
    );
  }

  const savedList = tracks.filter((t) => t.savedBy.includes(session.username));
  const sheetTrack = sheet ? allKnownTracks.find((t) => t.id === sheet.trackId) : null;
  const recentlyPlayedTracks = recentlyPlayed.map((id) => tracks.find((t) => t.id === id)).filter(Boolean);

  const sharedPageProps = {
    session, current, isPlaying, progress,
    onPlay: playTrackAtIndex,
    onLike: toggleLike,
    onSave: toggleSave,
    onShare: handleShare,
    onComment: (id) => setSheet({ type: "comments", trackId: id }),
    onLyrics: (id) => setSheet({ type: "lyrics", trackId: id }),
    onAddToPlaylist: (trackId) => setAddToPlaylistTrackId(trackId),
    onOpenArtist: goArtist,
    onPlayNext: playNext,
    onAddToQueue: addToQueue,
    onStartRadio: startRadio,
    onMoreLikeThis: moreLikeThis,
  };

  return (
    <>
      <div className="atmosphere atmosphere-grain" />
      <div className="atmosphere atmosphere-vignette" />
      <div className="atmosphere atmosphere-glow" />
      <Toast message={toast} />

      <div className="app-layout">
        {!submitMusicOpen && <SideNav active={activeTab} onChange={setActiveTab} onUpload={openUpload} session={session} onLogout={handleLogout} unreadNotifCount={unreadNotifCount} />}
        <div className="app-body">
        {!submitMusicOpen && <LeftSidebar active={activeTab} onChange={setActiveTab} session={session} onOpenSettings={() => setActiveTab("settings")} onOpenSupport={() => setActiveTab("support")} />}

        <main className="app-content">
            {submitMusicOpen && myArtist ? (
              <Suspense fallback={pageFallback}>
              <SubmitMusicPage
                myArtist={myArtist} editingId={submitMusicEditingId}
                onClose={closeSubmitMusic}
                onSaved={() => setSubmissionsRefreshKey((k) => k + 1)}
                onSubmitted={() => setSubmissionsRefreshKey((k) => k + 1)}
                showToast={showToast}
              />
              </Suspense>
            ) : (
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} variants={panelVariants} initial="initial" animate="animate" exit="exit">
                <Suspense fallback={pageFallback}>
                {activeTab === "onboarding" && (
                  <OnboardingPage
                    session={session}
                    onComplete={() => {
                      setSession((prev) => ({ ...prev, onboardingCompleted: true }));
                      goTab("home");
                    }}
                  />
                )}
                {activeTab === "not-found" && (
                  <NotFoundPage onGoHome={() => goTab("home")} />
                )}
                {activeTab === "access-denied" && (
                  <AccessDeniedPage onGoHome={() => goTab("home")} />
                )}
                {activeTab === "become-artist" && (
                  <BecomeArtistPage
                    session={session}
                    showToast={showToast}
                    onBack={() => setActiveTab("profile")}
                    onArtistCreated={(artist) => {
                      setMyArtist(artist);
                      setActiveTab("profile");
                      showToast("Đã tạo hồ sơ nghệ sĩ!");
                    }}
                  />
                )}
                {activeTab === "artist" && viewingArtist && (
                  <ArtistProfilePage
                    username={viewingArtist} session={session}
                    onBack={() => goTab("home")}
                    onOpenDashboard={() => goTab("artist-dashboard")}
                    current={current} isPlaying={isPlaying} progress={progress}
                    onPlay={playTrackAtIndex} onLike={toggleLike} onSave={toggleSave} onShare={handleShare}
                    onComment={(id) => setSheet({ type: "comments", trackId: id })}
                    onLyrics={(id) => setSheet({ type: "lyrics", trackId: id })}
                    onOpenArtist={goArtist}
                    onShareArtist={(data) => openShare("artist", data)}
                    onPlayNext={playNext} onAddToQueue={addToQueue}
                    onAddToPlaylist={(trackId) => setAddToPlaylistTrackId(trackId)}
                  />
                )}
                {activeTab === "explore" && (
                  <ExplorePage
                    session={session} tracks={tracks}
                    current={current} isPlaying={isPlaying} progress={progress}
                    onPlay={playTrackAtIndex}
                    onLike={toggleLike} onSave={toggleSave} onShare={handleShare}
                    onComment={(id) => setSheet({ type: "comments", trackId: id })}
                    onLyrics={(id) => setSheet({ type: "lyrics", trackId: id })}
                    onAddToPlaylist={(trackId) => setAddToPlaylistTrackId(trackId)}
                    onOpenArtist={goArtist}
                    onOpenGenre={(name) => setViewingGenre(name)}
                  />
                )}
                {activeTab === "listening-stats" && (
                  <ListeningStatsPage
                    onOpenArtist={goArtist}
                  />
                )}
                {activeTab === "home" && (
                  <HomePage
                    tracks={tracks} recentlyPlayedTracks={recentlyPlayedTracks}
                    continueListeningTracks={continueListeningTracks}
                    followedUsernames={followedUsernames}
                    onOpenArtist={goArtist}
                    {...sharedPageProps}
                  />
                )}
                {activeTab === "discover" && (
                  <DiscoverPage
                    session={session} tracks={tracks}
                    current={current} isPlaying={isPlaying} progress={progress}
                    onPlay={playTrackAtIndex}
                    onLike={toggleLike} onSave={toggleSave} onShare={handleShare}
                    onComment={(id) => setSheet({ type: "comments", trackId: id })}
                    onLyrics={(id) => setSheet({ type: "lyrics", trackId: id })}
                    onAddToPlaylist={(trackId) => setAddToPlaylistTrackId(trackId)}
                    onOpenArtist={goArtist}
                    onOpenGenre={(name) => setViewingGenre(name)}
                    onOpenPlaylist={goPlaylist}
                  />
                )}
                {activeTab === "search" && (
                  <SearchPage
                    session={session} tracks={tracks}
                    current={current} isPlaying={isPlaying} progress={progress}
                    onPlay={playTrackAtIndex}
                    onLike={toggleLike} onSave={toggleSave} onShare={handleShare}
                    onComment={(id) => setSheet({ type: "comments", trackId: id })}
                    onLyrics={(id) => setSheet({ type: "lyrics", trackId: id })}
                    onAddToPlaylist={(trackId) => setAddToPlaylistTrackId(trackId)}
                    onOpenArtist={goArtist}
                    onOpenGenre={(name) => setViewingGenre(name)}
                    onOpenPlaylist={goPlaylist}
                  />
                )}
                {activeTab === "library" && (
                  <LibraryPage
                    session={session}
                    current={current} isPlaying={isPlaying} progress={progress}
                    onPlay={playTrackAtIndex}
                    onLike={toggleLike} onSave={toggleSave} onShare={handleShare}
                    onComment={(id) => setSheet({ type: "comments", trackId: id })}
                    onLyrics={(id) => setSheet({ type: "lyrics", trackId: id })}
                    onOpenArtist={goArtist}
                    onOpenPlaylist={goPlaylist}
                    onCreatePlaylist={() => setCreatePlaylistOpen(true)}
                    onPlayNext={playNext} onAddToQueue={addToQueue} onAddToPlaylist={(trackId) => setAddToPlaylistTrackId(trackId)}
                  />
                )}
                {activeTab === "notifications" && (
                  <NotificationsPage
                    session={session}
                    onOpenTrack={(id) => {
                      const idx = tracks.findIndex((t) => t.id === id);
                      if (idx >= 0) playTrackAtIndex(tracks, idx);
                      setActiveTab("home");
                    }}
                    onOpenArtist={goArtist}
                  />
                )}
                {activeTab === "saved" && <SavedPage savedList={savedList} {...sharedPageProps} />}
                {activeTab === "settings" && (
                  <SettingsPage session={session} showToast={showToast} onBack={() => setActiveTab("profile")} onOpenOnboarding={() => setActiveTab("onboarding")} />
                )}
                {activeTab === "support" && (
                  <SupportPage session={session} showToast={showToast} onBack={() => setActiveTab("profile")} />
                )}
                {activeTab === "profile" && (
                  <ProfilePage
                    session={session} myTracksState={myTracksState}
                    current={current} isPlaying={isPlaying}
                    onPlay={playTrackAtIndex} onLike={toggleLike} onSave={toggleSave} onShare={handleShare}
                    onComment={(id) => setSheet({ type: "comments", trackId: id })}
                    onLyrics={(id) => setSheet({ type: "lyrics", trackId: id })}
                    onLogout={handleLogout}
                    myArtist={myArtist}
                    onBecomeArtist={() => setActiveTab("become-artist")}
                    onOpenArtistProfile={() => { setViewingArtist(session.username); setActiveTab("artist"); }}
                    onOpenArtistDashboard={() => goTab("artist-dashboard")}
                    onAddToPlaylist={(trackId) => setAddToPlaylistTrackId(trackId)}
                    onPlayNext={playNext} onAddToQueue={addToQueue}
                    onOpenSettings={() => setActiveTab("settings")}
                    onOpenSupport={() => setActiveTab("support")}
                  />
                )}
                {activeTab === "artist-dashboard" && (
                  <ArtistDashboardPage
                    session={session} showToast={showToast}
                    onClose={() => { goTab("profile"); refreshMyArtist(); }}
                    onOpenSubmitMusic={openSubmitMusic}
                    submissionsRefreshKey={submissionsRefreshKey}
                    onOpenArtist={() => { setViewingArtist(session.username); goTab("artist"); }}
                  />
                )}
                </Suspense>
              </motion.div>
            </AnimatePresence>
            )}
          </main>

        {!submitMusicOpen && (
          <RightPanel
            trending={trending}
            current={current} currentTrack={currentLocalTrack}
            isPlaying={isPlaying} progress={progress}
            session={session} volume={volume} queue={queue} queueIndex={queueIndex}
            onPlay={playTrackAtIndex} onLike={toggleLike}
            onToggle={togglePlayPause} onPrev={handlePrev} onNext={handleNext}
            onSeek={handleSeek} onVolume={handleVolume}
            onOpenQueue={() => setSheet({ type: "queue" })}
            shuffleEnabled={shuffleEnabled} onShuffleToggle={() => setShuffleEnabled((v) => { const n = !v; lsSet("player_shuffle", n); return n; })}
            repeatMode={repeatMode} onRepeatToggle={() => setRepeatMode((m) => { const next = m === "off" ? "all" : m === "all" ? "one" : "off"; lsSet("player_repeat", next); return next; })}
          />
        )}
        </div>
      </div>

      {!submitMusicOpen && <BottomNav active={activeTab} onChange={setActiveTab} unreadNotifCount={unreadNotifCount} />}

      {!submitMusicOpen && current && !npOpen && (
        <MiniPlayer
          current={current} isPlaying={isPlaying} progress={progress}
          session={session} currentTrack={currentLocalTrack}
          onOpen={() => setNpOpen(true)} onPrev={handlePrev} onToggle={togglePlayPause} onNext={handleNext}
          onSeek={handleSeek}
          onLike={() => toggleLike(current.trackId)}
          onLyrics={() => currentLocalTrack && setSheet({ type: "lyrics", trackId: current.trackId })}
          shuffleEnabled={shuffleEnabled} repeatMode={repeatMode}
          onToggleShuffle={toggleShuffle} onToggleRepeat={toggleRepeat}
          audioState={audioState} audioError={audioError} onRetry={retryAudio}
        />
      )}

      <AnimatePresence>
        {current && npOpen && (            <FullPlayer
            {...sharedPageProps}
            volume={volume} queue={queue} queueIndex={queueIndex}
            tracks={tracks} currentTrack={currentLocalTrack}
            onClose={() => setNpOpen(false)} onToggle={togglePlayPause}
            onPrev={handlePrev} onNext={handleNext} onSeek={handleSeek} onVolume={handleVolume}
            onOpenQueue={() => setSheet({ type: "queue" })}
            onOpenArtist={goArtist}
            commentDraft={commentDraft} onCommentDraftChange={setCommentDraft}
            onCommentSubmit={() => submitComment(current.trackId)}
            shuffleEnabled={shuffleEnabled} repeatMode={repeatMode}
            onToggleShuffle={toggleShuffle} onToggleRepeat={toggleRepeat}
            sleepTimer={sleepTimer} sleepTimerRemaining={sleepTimerRemaining}
            onStartSleepTimer={startSleepTimer} onClearSleepTimer={clearSleepTimer}
            audioState={audioState} audioError={audioError} onRetry={retryAudio}
          />
        )}
      </AnimatePresence>



      <AnimatePresence>
        {viewingPlaylist && (
          <Suspense fallback={pageFallback}>
          <PlaylistDetailPage
            playlistId={viewingPlaylist} session={session}
            current={current} isPlaying={isPlaying} progress={progress}
            onClose={() => setViewingPlaylist(null)}
            onPlay={playTrackAtIndex} onLike={toggleLike} onSave={toggleSave} onShare={handleShare}
            onComment={(id) => setSheet({ type: "comments", trackId: id })}
            onLyrics={(id) => setSheet({ type: "lyrics", trackId: id })}
            onOpenArtist={goArtist}
            onSharePlaylist={(data) => openShare("playlist", data)}
            showToast={showToast}
          />
          </Suspense>
        )}
      </AnimatePresence>







      <Sheet open={sheet && sheet.type === "comments"} onClose={() => setSheet(null)} labelledBy="comments-title">
        <CommentsPanel track={sheetTrack} draft={commentDraft} onDraftChange={setCommentDraft} onSubmit={() => submitComment(sheet.trackId)} />
      </Sheet>

      <Sheet open={sheet && sheet.type === "lyrics"} onClose={() => setSheet(null)} labelledBy="lyrics-title">
        <LyricsPanel track={sheetTrack} />
      </Sheet>

      <Sheet open={sheet && sheet.type === "queue"} onClose={() => setSheet(null)} labelledBy="queue-title">
        {current && (
          <QueuePanel
            queue={queue} queueIndex={queueIndex} isPlaying={isPlaying}
            onPlayAt={(idx) => playTrackAtIndex(queue, idx)}
            onRemove={removeFromQueue} onClearUpcoming={clearUpcoming}
            onTogglePlayPause={togglePlayPause}
          />
        )}
      </Sheet>

      <Sheet open={!!addToPlaylistTrackId} onClose={() => setAddToPlaylistTrackId(null)} labelledBy="add-to-playlist-title">
        <AddToPlaylistSheet trackId={addToPlaylistTrackId} onClose={() => setAddToPlaylistTrackId(null)} showToast={showToast} />
      </Sheet>
      <Sheet open={createPlaylistOpen} onClose={() => setCreatePlaylistOpen(false)} labelledBy="create-playlist-title">
        <CreatePlaylistSheet onClose={() => setCreatePlaylistOpen(false)} onCreated={(p) => { setViewingPlaylist(p.id); }} showToast={showToast} />
      </Sheet>

      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} {...shareData} onShareComplete={() => showToast("Đã chia sẻ!")} />

      <audio ref={audioRef} preload="metadata" />
      <div ref={ytContainerRef} style={{ position: "fixed", width: 1, height: 1, overflow: "hidden", opacity: 0, top: -100, pointerEvents: "none" }} />
    </>
  );
}
