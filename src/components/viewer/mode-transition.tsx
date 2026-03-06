"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ViewerMode } from "@/lib/types/stores";

interface ModeTransitionProps {
  mode: ViewerMode;
  children: React.ReactNode;
}

export function ModeTransition({ mode, children }: ModeTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={mode}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="h-full w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
