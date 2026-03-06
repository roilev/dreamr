"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FolderOpen, User } from "lucide-react";
import type { SpaceRow } from "@/lib/supabase/types";

interface SpaceCardProps {
  space: SpaceRow;
  owner?: { email: string | null; display_name: string | null } | null;
}

export function SpaceCard({ space, owner }: SpaceCardProps) {
  const ownerLabel = owner?.display_name || owner?.email || null;

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
            <div className="mt-2 flex items-center gap-3">
              <p className="text-xs text-[var(--text-muted)]">
                {new Date(space.created_at).toLocaleDateString()}
              </p>
              {ownerLabel && (
                <span className="flex items-center gap-1 rounded-full bg-[var(--accent-primary)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--accent-primary)]">
                  <User size={10} />
                  {ownerLabel}
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
