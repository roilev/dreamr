"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FolderOpen } from "lucide-react";
import type { SpaceRow } from "@/lib/supabase/types";

export function SpaceCard({ space }: { space: SpaceRow }) {
  return (
    <Link href={`/spaces/${space.id}`}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="glow-border bg-[var(--bg-surface)] p-5 cursor-pointer"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-primary)]/10">
            <FolderOpen size={18} className="text-[var(--accent-primary)]" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-[var(--text-primary)] truncate">{space.name}</h3>
            {space.description && (
              <p className="mt-1 text-sm text-[var(--text-secondary)] line-clamp-2">{space.description}</p>
            )}
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {new Date(space.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
