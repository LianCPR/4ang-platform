import { motion } from "framer-motion";
import { Flower } from "../assets/Botanical";

export default function LoadingScreen() {
  return (
    <div className="loading-screen">
      <motion.div
        className="loading-mark"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="brand-diamond brand-diamond-lg" />
        <span className="loading-word">4ANG</span>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{ opacity: 1, scaleY: 1 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="loading-rule"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.35 }}
      >
        <Flower size={28} className="loading-sprig" />
        <p className="loading-caption">Đang tải...</p>
      </motion.div>
    </div>
  );
}
