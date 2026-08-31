import { AnimatePresence, motion } from "framer-motion";
import { sheetOverlayVariants, sheetVariants } from "../lib/motion";

export default function Sheet({ open, onClose, children, labelledBy }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="sheet-overlay"
          variants={sheetOverlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          onClick={onClose}
        >
          <motion.div
            className="sheet"
            variants={sheetVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
          >
            <div className="sheet-handle" />
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
