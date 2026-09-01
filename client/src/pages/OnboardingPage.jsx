import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Music, Heart, Sparkles, ArrowRight, ArrowLeft, Check,
  Users, Headphones, Play, Star, PartyPopper, ChevronRight,
} from "lucide-react";
import { api } from "../api";
import { gradientFor, hashHue } from "../lib/format";

/* ── Genre data with emojis and gradients ── */
const GENRE_META = {
  "Ballad": { emoji: "🎵", gradient: "linear-gradient(135deg, #D9A3A0, #E8C4C1)" },
  "Pop": { emoji: "🎤", gradient: "linear-gradient(135deg, #C9A76B, #EBC6A8)" },
  "Rap/Hip-hop": { emoji: "🔥", gradient: "linear-gradient(135deg, #715A45, #8B7355)" },
  "R&B": { emoji: "💜", gradient: "linear-gradient(135deg, #9AA68A, #B5C4A5)" },
  "Rock": { emoji: "⚡", gradient: "linear-gradient(135deg, #6F8066, #8B9B80)" },
  "EDM/Dance": { emoji: "🌊", gradient: "linear-gradient(135deg, #4A8FE2, #7AB3ED)" },
  "Acoustic": { emoji: "🎸", gradient: "linear-gradient(135deg, #C9A76B, #D8B46A)" },
  "Bolero": { emoji: "🎶", gradient: "linear-gradient(135deg, #D9A3A0, #C08583)" },
  "Indie": { emoji: "🌙", gradient: "linear-gradient(135deg, #8B7355, #A09888)" },
  "Nhạc trẻ": { emoji: "✨", gradient: "linear-gradient(135deg, #E8C4C1, #F0D4CF)" },
  "Nhạc trữ tình": { emoji: "🌸", gradient: "linear-gradient(135deg, #D9A3A0, #E8C4C1)" },
  "Khác": { emoji: "💫", gradient: "linear-gradient(135deg, #9AA68A, #B5C4A5)" },
};

/* ── Animation variants ── */
const pageVariants = {
  enter: (dir) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

const stagger = { animate: { transition: { staggerChildren: 0.06 } } };
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

/* ── Progress dots ── */
function ProgressDots({ step, total }) {
  return (
    <div className="ob-progress">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`ob-dot ${i <= step ? "ob-dot-active" : ""} ${i < step ? "ob-dot-done" : ""}`}>
          {i < step ? <Check size={10} /> : null}
        </div>
      ))}
    </div>
  );
}

/* ── STEP 1: Welcome ── */
function WelcomeStep({ onNext, username }) {
  return (
    <motion.div className="ob-step ob-welcome" variants={stagger} initial="initial" animate="animate">
      <motion.div className="ob-welcome-icon" variants={fadeUp}>
        <div className="ob-welcome-diamond" />
      </motion.div>
      <motion.h1 className="ob-title" variants={fadeUp}>
        Chào mừng bạn đến với<br />
        <span className="ob-title-accent">4ANG</span>
      </motion.h1>
      <motion.p className="ob-subtitle" variants={fadeUp}>
        Nơi âm nhạc kể chuyện. Trải nghiệm nghe nhạc được thiết kế riêng cho bạn.
      </motion.p>
      <motion.p className="ob-welcome-name" variants={fadeUp}>
        Xin chào, <strong>{username}</strong>
      </motion.p>
      <motion.div className="ob-welcome-features" variants={fadeUp}>
        <div className="ob-feature">
          <Music size={18} />
          <span>Khám phá nhạc theo gu của bạn</span>
        </div>
        <div className="ob-feature">
          <Heart size={18} />
          <span>Lưu bài hát yêu thích</span>
        </div>
        <div className="ob-feature">
          <Users size={18} />
          <span>Theo dõi nghệ sĩ yêu thích</span>
        </div>
      </motion.div>
      <motion.button className="ob-btn-primary" onClick={onNext} variants={fadeUp}>
        Bắt đầu <ArrowRight size={16} />
      </motion.button>
      <motion.button className="ob-skip-btn" onClick={onNext} variants={fadeUp}>
        Bỏ qua, khám phá ngay
      </motion.button>
    </motion.div>
  );
}

/* ── STEP 2: Genre Selection ── */
function GenreStep({ selected, onToggle, onNext, onBack, genres }) {
  return (
    <motion.div className="ob-step" variants={stagger} initial="initial" animate="animate">
      <motion.button className="ob-back" onClick={onBack} variants={fadeUp}>
        <ArrowLeft size={16} /> Quay lại
      </motion.button>
      <motion.h2 className="ob-title" variants={fadeUp}>Chọn thể loại bạn thích</motion.h2>
      <motion.p className="ob-subtitle" variants={fadeUp}>
        Chọn thể loại bạn thích để 4ANG gợi ý nhạc phù hợp. (Tùy chọn)
      </motion.p>
      <motion.div className="ob-genre-grid" variants={fadeUp}>
        {genres.map((g) => {
          const meta = GENRE_META[g.name] || GENRE_META["Khác"];
          const active = selected.includes(g.name);
          return (
            <button
              key={g.name}
              className={`ob-genre-card ${active ? "ob-genre-active" : ""}`}
              onClick={() => onToggle(g.name)}
            >
              <div className="ob-genre-art" style={{ background: meta.gradient }}>
                <span className="ob-genre-emoji">{meta.emoji}</span>
                {active && (
                  <motion.div className="ob-genre-check" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                    <Check size={14} />
                  </motion.div>
                )}
              </div>
              <span className="ob-genre-name">{g.name}</span>
              {g.trackCount > 0 && (
                <span className="ob-genre-count">{g.trackCount} bài</span>
              )}
            </button>
          );
        })}
      </motion.div>
      <motion.div className="ob-step-footer" variants={fadeUp}>
        <button className="ob-skip-btn" onClick={onNext}>Bỏ qua</button>
        <button className="ob-btn-primary" onClick={onNext}>
          Tiếp tục <ArrowRight size={16} />
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ── STEP 3: Artist Selection ── */
function ArtistStep({ selected, onToggle, onNext, onBack, artists }) {
  return (
    <motion.div className="ob-step" variants={stagger} initial="initial" animate="animate">
      <motion.button className="ob-back" onClick={onBack} variants={fadeUp}>
        <ArrowLeft size={16} /> Quay lại
      </motion.button>
      <motion.h2 className="ob-title" variants={fadeUp}>Theo dõi nghệ sĩ</motion.h2>
      <motion.p className="ob-subtitle" variants={fadeUp}>
        Theo dõi nghệ sĩ bạn thích. Bạn có thể thay đổi sau.
      </motion.p>
      <motion.div className="ob-artist-grid" variants={fadeUp}>
        {artists.map((a) => {
          const active = selected.includes(a.username);
          const hue = hashHue(a.username);
          return (
            <button
              key={a.username}
              className={`ob-artist-card ${active ? "ob-artist-active" : ""}`}
              onClick={() => onToggle(a.username)}
            >
              <div className="ob-artist-avatar" style={
                a.avatarUrl
                  ? { backgroundImage: `url('${a.avatarUrl}')` }
                  : { background: gradientFor(hue) }
              }>
                {!a.avatarUrl && <Users size={22} style={{ color: "rgba(255,255,255,0.7)" }} />}
                {active && (
                  <motion.div className="ob-artist-check" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                    <Check size={14} />
                  </motion.div>
                )}
              </div>
              <span className="ob-artist-name">{a.artistName || a.username}</span>
              {a.verificationStatus === "verified" && (
                <span className="ob-artist-badge">✓ Verified</span>
              )}
            </button>
          );
        })}
      </motion.div>
      <motion.div className="ob-step-footer" variants={fadeUp}>
        <button className="ob-skip-btn" onClick={onNext}>Bỏ qua</button>
        <button className="ob-btn-primary" onClick={onNext}>
          Tiếp tục <ArrowRight size={16} />
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ── STEP 4: Complete ── */
function CompleteStep({ username, onComplete }) {
  return (
    <motion.div className="ob-step ob-complete" variants={stagger} initial="initial" animate="animate">
      <motion.div className="ob-complete-icon" variants={fadeUp}>
        <PartyPopper size={40} />
      </motion.div>
      <motion.h2 className="ob-title" variants={fadeUp}>
        Bạn đã sẵn sàng!
      </motion.h2>
      <motion.p className="ob-subtitle" variants={fadeUp}>
        4ANG đã được cá nhân hóa cho bạn. <br />
        Bắt đầu khám phá âm nhạc ngay thôi!
      </motion.p>
      <motion.div className="ob-complete-preview" variants={fadeUp}>
        <div className="ob-preview-card">
          <Sparkles size={20} />
          <span>Gợi ý âm nhạc phù hợp với bạn</span>
        </div>
        <div className="ob-preview-card">
          <Headphones size={20} />
          <span>Khám phá nghệ sĩ mới</span>
        </div>
        <div className="ob-preview-card">
          <Play size={20} />
          <span>Nghe nhạc không giới hạn</span>
        </div>
      </motion.div>
      <motion.button className="ob-btn-primary ob-btn-glow" onClick={onComplete} variants={fadeUp}>
        <Star size={16} /> Khám phá 4ANG
      </motion.button>
      <motion.button className="ob-skip-btn" onClick={onComplete} variants={fadeUp} style={{ marginTop: 12 }}>
        Bỏ qua, tôi sẽ khám phá sau
      </motion.button>
    </motion.div>
  );
}

/* ── MAIN ONBOARDING PAGE ── */
export default function OnboardingPage({ session, onComplete }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [genres, setGenres] = useState([]);
  const [artists, setArtists] = useState([]);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedArtists, setSelectedArtists] = useState([]);
  const [saving, setSaving] = useState(false);

  /* Load genres + all artists */
  useEffect(() => {
    api.discoverGenres().then((d) => setGenres(d.genres || [])).catch(() => {});
    api.fetchAllArtists().then((d) => {
      setArtists(d.artists || []);
    }).catch(() => {
      api.risingArtists(50).then((d2) => setArtists(d2.artists || [])).catch(() => {});
    });
  }, []);

  const toggleGenre = useCallback((name) => {
    setSelectedGenres((prev) =>
      prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name]
    );
  }, []);

  const toggleArtist = useCallback((username) => {
    setSelectedArtists((prev) =>
      prev.includes(username) ? prev.filter((a) => a !== username) : [...prev, username]
    );
  }, []);

  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, 3));
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const handleComplete = useCallback(async () => {
    setSaving(true);
    try {
      await api.savePreferences({
        favoriteGenres: selectedGenres,
        favoriteArtists: selectedArtists,
        onboardingStep: 3,
      });
      await api.completeOnboarding();
      onComplete();
    } catch (e) {
      console.error("Onboarding save error:", e);
      onComplete(); // proceed anyway
    }
  }, [selectedGenres, selectedArtists, onComplete]);

  const steps = [
    <WelcomeStep key="welcome" onNext={goNext} username={session?.displayName || session?.username} />,
    <GenreStep key="genres" selected={selectedGenres} onToggle={toggleGenre} onNext={goNext} onBack={goBack} genres={genres} />,
    <ArtistStep key="artists" selected={selectedArtists} onToggle={toggleArtist} onNext={goNext} onBack={goBack} artists={artists} />,
    <CompleteStep key="complete" username={session?.username} onComplete={handleComplete} />,
  ];

  return (
    <div className="ob-page">
      <div className="ob-page-bg" />
      <div className="ob-page-grain" />
      <div className="ob-container">
        <ProgressDots step={step} total={4} />
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="ob-page-inner"
          >
            {steps[step]}
          </motion.div>
        </AnimatePresence>
      </div>
      {saving && (
        <div className="ob-saving-overlay">
          <div className="ob-saving-spinner" />
          <span>Đang lưu...</span>
        </div>
      )}
    </div>
  );
}
