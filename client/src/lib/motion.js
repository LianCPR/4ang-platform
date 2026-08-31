export const EASE_OUT = [0.16, 1, 0.3, 1];
export const EASE_IN_OUT = [0.65, 0, 0.35, 1];

// Page/panel transition — a slow, cinematic fade+rise, like turning a page.
export const panelVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE_OUT } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.22, ease: EASE_IN_OUT } },
};

// Card entrance with a small stagger — used for feed / list items.
export function cardVariants(index = 0) {
  return {
    initial: { opacity: 0, y: 12 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.38, ease: EASE_OUT, delay: Math.min(index * 0.045, 0.4) },
    },
  };
}

// Generic bottom sheet (comments, lyrics, upload).
export const sheetOverlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.22 } },
  exit: { opacity: 0, transition: { duration: 0.18 } },
};

export const sheetVariants = {
  initial: { y: "100%" },
  animate: { y: 0, transition: { type: "spring", stiffness: 340, damping: 34 } },
  exit: { y: "100%", transition: { duration: 0.26, ease: EASE_IN_OUT } },
};

export const modalVariants = {
  initial: { opacity: 0, y: 14, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: EASE_OUT } },
  exit: { opacity: 0, y: 8, scale: 0.99, transition: { duration: 0.18, ease: EASE_IN_OUT } },
};

export const toastVariants = {
  initial: { opacity: 0, y: 16, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: EASE_OUT } },
  exit: { opacity: 0, y: 8, transition: { duration: 0.2, ease: EASE_IN_OUT } },
};

export const tapScale = { scale: 0.96 };
