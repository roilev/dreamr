"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/spaces");
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-[var(--text-muted)]"
        >
          <div className="h-6 w-6 rounded-full border-2 border-current border-t-transparent animate-spin" />
        </motion.div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-white opacity-[0.02] blur-[150px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center text-center px-6"
      >
        <h1 className="text-5xl font-bold tracking-tight sm:text-7xl uppercase">
          <span className="text-[var(--text-primary)]">Dreamr</span>
        </h1>

        <p className="mt-6 max-w-lg text-lg text-[var(--text-secondary)] leading-relaxed">
          Create explorable 3D worlds from text and images.
        </p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          360° panoramas, video, depth, and Gaussian splats — powered by AI.
        </p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-10 flex items-center gap-4"
        >
          <Link href="/sign-in">
            <motion.span
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="glow-button inline-flex items-center gap-2 text-sm uppercase tracking-wider"
            >
              Get Started
              <ArrowRight size={16} />
            </motion.span>
          </Link>
          <Link
            href="/sign-up"
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Create account
          </Link>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-8 text-xs text-[var(--text-muted)]"
      >
        Built for dreamers and creators
      </motion.div>
    </main>
  );
}
