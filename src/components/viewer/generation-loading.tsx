"use client";

import { motion } from "framer-motion";
import type { PipelineProgress } from "@/hooks/use-generation-tracker";

interface Props {
  progress?: PipelineProgress | null;
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export function GenerationLoading({ progress }: Props) {
  const fraction = progress
    ? (progress.subStep + 0.5) / progress.totalSubSteps
    : 0;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10 gap-6">
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

      {/* Progress info */}
      <div className="relative flex flex-col items-center gap-2">
        <motion.span
          className="text-sm text-white/50 font-medium tracking-wide"
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          {progress?.subStepLabel ?? "Generating..."}
        </motion.span>

        {progress && (
          <>
            {/* Step progress bar */}
            <div className="w-48 h-1 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-white/30"
                initial={{ width: 0 }}
                animate={{ width: `${fraction * 100}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>

            <span className="text-xs text-white/30 tabular-nums">
              Step {progress.subStep + 1} of {progress.totalSubSteps}
              {" · "}
              {formatElapsed(progress.elapsedMs)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
