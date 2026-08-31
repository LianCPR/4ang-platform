// ═══════════════════════════════════════════════════════════
// DEMO DATA — Realistic mock content for 4ANG UI
// Used when backend has insufficient data
// ═══════════════════════════════════════════════════════════

// Unsplash images — nature, floral, warm, musical themes
export const DEMO_COVERS = [
  "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1484755560615-a4c64e778a6c?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1501612780327-45045538702b?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1446057032654-9d8885db76c6?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=400&h=400&fit=crop",
];

export const DEMO_COVERS_NATURE = [
  "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1462275646964-a0e3c11f18a6?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1487530811176-3780de880c2d?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&h=400&fit=crop",
];

export const DEMO_AVATARS = [
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop",
];

export const DEMO_MOOD_COVERS = [
  "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1501612780327-45045538702b?w=600&h=400&fit=crop",
];

export const MOOD_CATEGORIES = [
  { id: "sunny", title: "Bu\u1EDBng s\u00E1ng d\u1EC7 d\u00E0ng", emoji: "\u2600\uFE0F", hue: 35, cover: DEMO_MOOD_COVERS[0] },
  { id: "sunset", title: "Chill c\u00F9ng ho\u00E0ng h\u00F4n", emoji: "\uD83C\uDF05", hue: 20, cover: DEMO_MOOD_COVERS[1] },
  { id: "night", title: "\u0110\u00EAm mu\u1ED9n", emoji: "\uD83C\uDF19", hue: 250, cover: DEMO_MOOD_COVERS[2] },
  { id: "rain", title: "Nh\u1EEFng ng\u00E0y m\u01A1a", emoji: "\uD83C\uDF27\uFE0F", hue: 200, cover: DEMO_MOOD_COVERS[3] },
  { id: "focus", title: "T\u1EADp trung h\u1ECDc t\u1EADp", emoji: "\uD83D\uDCD6", hue: 160, cover: DEMO_COVERS[6] },
  { id: "chill", title: "Th\u01B0 gi\u1EA3n", emoji: "\uD83C\uDF43", hue: 120, cover: DEMO_COVERS[7] },
];

export const AFTERNOON_MOODS = [
  { title: "Sunlit\nAcoustic", subtitle: "36 songs", hue: 35, cover: DEMO_MOOD_COVERS[0] },
  { title: "Blooming\nDays", subtitle: "28 songs", hue: 350, cover: DEMO_MOOD_COVERS[1] },
  { title: "Feel Good\nToday", subtitle: "32 songs", hue: 120, cover: DEMO_MOOD_COVERS[2] },
  { title: "A Moment\nAlone", subtitle: "27 songs", hue: 210, cover: DEMO_MOOD_COVERS[3] },
];

export const DEMO_SUGGESTED_SONGS = [
  { id: "demo-1", title: "Con M\u1EADu T\u00ED T\u1EAFch", artist: "VCC Left Hand \u00D7 Hest", duration: 252, cover: DEMO_COVERS[0], genres: ["Pop", "Indie"] },
  { id: "demo-2", title: "Ch\u1EE7ng Ta C\u1EE7a Hi\u1EC7n T\u1EA1i", artist: "S\u1EDFn T\u00F9ng M-TP", duration: 231, cover: DEMO_COVERS[1], genres: ["Pop", "V-Pop"] },
  { id: "demo-3", title: "B\u1EBFt Gi\u00E1o Cu\u1ED9c \u0110i", artist: "T\u1ED5p C\u00E1m S\u1ECFng", duration: 285, cover: DEMO_COVERS[2], genres: ["Rap", "Hip-hop"] },
  { id: "demo-4", title: "H\u00E0 N\u1ED9i Tr\u1EDF V\u1EC1", artist: "SOOBIN", duration: 214, cover: DEMO_COVERS[3], genres: ["Pop", "R&B"] },
  { id: "demo-5", title: "N\u1EBFu Ng\u00E0y \u00C1y", artist: "SOOBIN \u00D7 4ANG", duration: 248, cover: DEMO_COVERS[4], genres: ["Pop", "Ballad"] },
  { id: "demo-6", title: "Bu\u1EDBt Qu\u00E1 Nh\u1EA1u", artist: "V\u00E3", duration: 198, cover: DEMO_COVERS[5], genres: ["Acoustic", "Indie"] },
  { id: "demo-7", title: "Gi\u1EDD \u0110\u00E3 L\u00E2y \u0110\u00F4ng T\u00E2y", artist: "Ph\u1EA1m Anh Kho\u00E1", duration: 276, cover: DEMO_COVERS[6], genres: ["Ballad", "Pop"] },
  { id: "demo-8", title: "Ch\u00E2u Tr\u1EDDi M\u1EDBi", artist: "Da LAB", duration: 243, cover: DEMO_COVERS[7], genres: ["Hip-hop", "Rap"] },
  { id: "demo-9", title: "T\u00ECnh Qu\u00EAn", artist: "Wren Evans", duration: 208, cover: DEMO_COVERS[8], genres: ["Pop", "R&B"] },
  { id: "demo-10", title: "Kh\u00F4ng Th\u1EC3", artist: "HIEUTHUHAI", duration: 227, cover: DEMO_COVERS[9], genres: ["Rap", "Hip-hop"] },
  { id: "demo-11", title: "M\u01A1a", artist: "Da LAB \u00D7 MIN", duration: 264, cover: DEMO_COVERS[10], genres: ["Pop", "Electronic"] },
  { id: "demo-12", title: "S\u1EAFe T\u1EA1m Bi\u1EC7t", artist: "Ho\u00E0ng Th\u1ECB Linh", duration: 235, cover: DEMO_COVERS[11], genres: ["Ballad", "Pop"] },
];

export const DEMO_SONGS = [
  { id: "demo-s1", title: "Con M\u1EADu T\u00ED T\u1EAFch", artist: "VCC Left Hand \u00D7 Hest \u00D7 B\u1EA3n", duration: 252, cover: DEMO_COVERS[0], playCount: 12400, likeCount: 890, genres: ["Pop", "Indie"] },
  { id: "demo-s2", title: "Ch\u1EE7ng Ta C\u1EE7a Hi\u1EC7n T\u1EA1i", artist: "S\u1EDFn T\u00F9ng M-TP", duration: 231, cover: DEMO_COVERS[1], playCount: 28500, likeCount: 2100, genres: ["Pop"] },
  { id: "demo-s3", title: "B\u1EBFt Gi\u00E1o Cu\u1ED9c \u0110i", artist: "T\u1ED5p C\u00E1m S\u1ECFng", duration: 285, cover: DEMO_COVERS[2], playCount: 9800, likeCount: 670, genres: ["Rap"] },
  { id: "demo-s4", title: "H\u00E0 N\u1ED9i Tr\u1EDF V\u1EC1", artist: "SOOBIN", duration: 214, cover: DEMO_COVERS[3], playCount: 18200, likeCount: 1340, genres: ["Pop", "R&B"] },
  { id: "demo-s5", title: "N\u1EBFs Ng\u00E0y \u00C1y", artist: "SOOBIN", duration: 248, cover: DEMO_COVERS[4], playCount: 15600, likeCount: 1120, genres: ["Pop"] },
  { id: "demo-s6", title: "Bu\u1EDBt Qu\u00E1 Nh\u1EA1u", artist: "V\u00E3", duration: 198, cover: DEMO_COVERS[5], playCount: 7400, likeCount: 520, genres: ["Acoustic"] },
  { id: "demo-s7", title: "Gi\u1EDD \u0110\u00E3 L\u00E2y \u0110\u00F4ng T\u00E2y", artist: "Ph\u1EA1m Anh Kho\u00E1", duration: 276, cover: DEMO_COVERS[6], playCount: 11300, likeCount: 830, genres: ["Ballad"] },
  { id: "demo-s8", title: "Ch\u00E2u Tr\u1EDDi M\u1EDBi", artist: "Da LAB", duration: 243, cover: DEMO_COVERS[7], playCount: 13100, likeCount: 960, genres: ["Hip-hop"] },
  { id: "demo-s9", title: "T\u00ECnh Qu\u00EAn", artist: "Wren Evans", duration: 208, cover: DEMO_COVERS[8], playCount: 8900, likeCount: 640, genres: ["Pop", "R&B"] },
  { id: "demo-s10", title: "Kh\u00F4ng Th\u1EC3", artist: "HIEUTHUHAI", duration: 227, cover: DEMO_COVERS[9], playCount: 22100, likeCount: 1580, genres: ["Rap"] },
  { id: "demo-s11", title: "M\u01A1a", artist: "Da LAB \u00D7 MIN", duration: 264, cover: DEMO_COVERS[10], playCount: 16800, likeCount: 1200, genres: ["Pop"] },
  { id: "demo-s12", title: "S\u1EAFe T\u1EA1m Bi\u1EC7t", artist: "Ho\u00E0ng Th\u1ECB Linh", duration: 235, cover: DEMO_COVERS[11], playCount: 6200, likeCount: 450, genres: ["Ballad"] },
];

export const DEMO_ARTISTS = [
  { id: "demo-a1", name: "SOOBIN", avatar: DEMO_AVATARS[0], genre: "Pop / R&B", monthlyListeners: "1.2M", badge: "verified", followers: "890K" },
  { id: "demo-a2", name: "V\u0169.", avatar: DEMO_AVATARS[1], genre: "Indie / Pop", monthlyListeners: "680K", badge: "verified", followers: "420K" },
  { id: "demo-a3", name: "Da LAB", avatar: DEMO_AVATARS[2], genre: "Hip-hop / Rap", monthlyListeners: "920K", badge: "verified", followers: "560K" },
  { id: "demo-a4", name: "Wren Evans", avatar: DEMO_AVATARS[3], genre: "Pop / R&B", monthlyListeners: "540K", badge: "verified", followers: "310K" },
  { id: "demo-a5", name: "HIEUTHUHAI", avatar: DEMO_AVATARS[4], genre: "Rap / Hip-hop", monthlyListeners: "1.8M", badge: "verified", followers: "1.1M" },
  { id: "demo-a6", name: "Ph\u1EA1m Anh Kho\u00E1", avatar: DEMO_AVATARS[5], genre: "Ballad / Pop", monthlyListeners: "760K", badge: "verified", followers: "480K" },
  { id: "demo-a7", name: "Ho\u00E0ng Th\u1ECB Linh", avatar: DEMO_AVATARS[6], genre: "Pop / Ballad", monthlyListeners: "420K", badge: "independent", followers: "280K" },
  { id: "demo-a8", name: "V\u00E3", avatar: DEMO_AVATARS[7], genre: "Acoustic / Indie", monthlyListeners: "350K", badge: "independent", followers: "190K" },
];

export const DEMO_GENRES = [
  "Pop", "Indie", "Acoustic", "Ballad", "R&B", "Hip-hop", "Rap", "Rock", "Electronic", "Nh\u1EEFng ng\u00E0y m\u01A1a",
];

export const SEARCH_SUGGESTION_CHIPS = [
  "Nh\u1EE1c chill", "Pop Vi\u1EC7t", "Nh\u1EE1c m\u1EDBi", "V-Pop", "Acoustic",
  "Ballad", "Indie", "R&B", "Nh\u1EE1c cho bu\u1EDBng chi\u1EC1u", "Nh\u1EE1c nh\u1EEFng ng\u00E0y m\u01A1a",
];

export const FEATURED_RELEASE = {
  id: DEMO_SONGS[0].id,
  title: "Con M\u1EADu\nT\u00ED T\u1EAFch",
  artist: "VCC Left Hand \u00D7 Hest \u00D7 B\u1EA3n",
  cover: DEMO_COVERS[0],
  label: "FEATURED RELEASE",
};

// Helper: pick a random cover by hue (0-360) for gradient fallback
export function demoCoverForHue(hue) {
  const idx = Math.abs(Math.round(hue / 30)) % DEMO_COVERS.length;
  return DEMO_COVERS[idx];
}

// Helper: merge real tracks with demo tracks (real first)
export function mergeWithDemo(realTracks, maxTotal = 12) {
  if (realTracks.length >= maxTotal) return realTracks.slice(0, maxTotal);
  const needed = maxTotal - realTracks.length;
  const demoSlice = DEMO_SONGS.slice(0, needed);
  return [...realTracks, ...demoSlice];
}

// Helper: merge real artists with demo artists
export function mergeArtistsWithDemo(realArtists, maxTotal = 8) {
  if (realArtists.length >= maxTotal) return realArtists.slice(0, maxTotal);
  const needed = maxTotal - realArtists.length;
  const demoSlice = DEMO_ARTISTS.slice(0, needed);
  return [...realArtists, ...demoSlice];
}
