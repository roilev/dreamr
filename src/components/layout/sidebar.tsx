"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Plus, Image, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { SceneRow } from "@/lib/supabase/types";

export function Sidebar() {
  const params = useParams();
  const pathname = usePathname();
  const spaceId = (params.spaceSlug ?? params.spaceId) as string | undefined;

  const { data: scenes, isLoading } = useQuery<SceneRow[]>({
    queryKey: ["scenes", spaceId],
    queryFn: async () => {
      const res = await fetch(`/api/spaces/${spaceId}/scenes`);
      if (!res.ok) throw new Error("Failed to fetch scenes");
      return res.json();
    },
    enabled: !!spaceId,
  });

  if (!spaceId) return null;

  return (
    <aside className="hidden md:flex w-56 flex-col border-r border-[var(--border-default)] bg-[var(--bg-secondary)]">
      <div className="flex items-center justify-between p-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
        <span>Scenes</span>
        <Link
          href={`/${spaceId}?new=1`}
          className="rounded p-1 hover:bg-[var(--bg-surface)] transition-colors"
        >
          <Plus size={14} />
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-2">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" />
          </div>
        )}
        {scenes?.map((scene) => {
          const href = `/${spaceId}/scene/${scene.short_id}`;
          const isActive = pathname === href;
          return (
            <Link
              key={scene.id}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]",
              )}
            >
              <Image size={14} />
              <span className="truncate">{scene.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
