// Drives the "dynamic artwork atmosphere" background glow (--ambient-a /
// --ambient-b in tokens.css) from whatever is actually playing.
//
// Two real data sources, no fabrication:
//  1. When the current item has a real cover image, we attempt genuine
//     pixel sampling via canvas.
//  2. Locally-hosted tracks with no cover art fall back to the same
//     deterministic hue-hash already used to paint that track's
//     placeholder artwork, so the glow always matches what's on screen.

import { hashHue } from "./format";

const DEFAULT_A = [154, 166, 138]; // sage green
const DEFAULT_B = [216, 180, 106]; // warm gold

const HUE_PAIRS_RGB = [
  [[154, 166, 138], [216, 180, 106]],
  [[217, 163, 160], [235, 198, 168]],
  [[216, 180, 106], [154, 166, 138]],
  [[113, 90, 69], [154, 166, 138]],
  [[217, 163, 160], [154, 166, 138]],
  [[216, 180, 106], [217, 163, 160]],
];

function clamp(n) { return Math.max(0, Math.min(255, Math.round(n))); }

function mix(a, b, t) {
  return [
    clamp(a[0] + (b[0] - a[0]) * t),
    clamp(a[1] + (b[1] - a[1]) * t),
    clamp(a[2] + (b[2] - a[2]) * t),
  ];
}

// Real pixel sampling — resolves null (not a guess) if it can't be read.
function sampleImageColor(url) {
  return new Promise((resolve) => {
    if (!url) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 24;
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 10) continue;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        }
        resolve(n ? [r / n, g / n, b / n] : null);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function hueFallback(title) {
  const [a, b] = HUE_PAIRS_RGB[hashHue(title || "") % HUE_PAIRS_RGB.length];
  return { a, b };
}

export async function resolveAmbient(item) {
  if (!item) return { a: DEFAULT_A, b: DEFAULT_B };
  if (item.thumb) {
    const rgb = await sampleImageColor(item.thumb);
    if (rgb) return { a: rgb, b: mix(rgb, DEFAULT_B, 0.5) };
  }
  return hueFallback(item.title);
}

export function applyAmbient({ a, b }) {
  const root = document.documentElement.style;
  root.setProperty("--ambient-a", a.join(", "));
  root.setProperty("--ambient-b", b.join(", "));
}
