"use client";

import { motion } from "framer-motion";

export function GenerationLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
      {/* Animated radial glow */}
      <motion.div
        className="absolute"
        style={{
          width: "60%",
          height: "60%",
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 40%, transparent 70%)",
          filter: "blur(40px)",
        }}
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.6, 1, 0.6],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Inner bright core */}
      <motion.div
        className="absolute"
        style={{
          width: "25%",
          height: "25%",
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
          filter: "blur(20px)",
        }}
        animate={{
          scale: [0.9, 1.1, 0.9],
          opacity: [0.8, 1, 0.8],
        }}
        transition={{
          duration: 2.4,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.3,
        }}
      />

      {/* Loading text */}
      <motion.span
        className="relative text-sm text-white/40 font-medium tracking-wide"
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        Loading...
      </motion.span>
    </div>
  );
}
