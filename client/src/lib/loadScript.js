// Loads an external <script> tag exactly once, even if called from several
// places in quick succession — subsequent calls reuse the same promise.
const scriptCache = new Map();

export function loadScript(src) {
  if (scriptCache.has(src)) return scriptCache.get(src);
  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) { resolve(); return; }
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("Không tải được " + src));
    document.head.appendChild(el);
  });
  scriptCache.set(src, promise);
  return promise;
}
