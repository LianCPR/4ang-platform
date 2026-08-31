import { AnimatePresence, motion } from "framer-motion";
import { toastVariants } from "../lib/motion";

export default function Toast({ message }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key={message}
          className="toast"
          variants={toastVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          role="status"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
