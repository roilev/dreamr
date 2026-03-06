"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Plus, ArrowLeft, Image } from "lucide-react";
import { motion } from "framer-motion";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/skeleton";
import type { SpaceRow, SceneRow } from "@/lib/supabase/types";

export default function SpaceDetailPage({ params }: { params: Promise<{ spaceSlug: string }> }) {
  const { spaceSlug } = use(params);
  const router = useRouter();

  const { data: space } = useQuery<SpaceRow & { owner?: { email: string | null; display_name: string | null } }>({
    queryKey: ["space", spaceSlug],
    queryFn: async () => {
      const res = await fetch(`/api/spaces/${spaceSlug}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: scenes, isLoading: scenesLoading } = useQuery<SceneRow[]>({
    queryKey: ["scenes", spaceSlug],
    queryFn: async () => {
      const res = await fetch(`/api/spaces/${spaceSlug}/scenes`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const createScene = async () => {
    const res = await fetch(`/api/spaces/${spaceSlug}/scenes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" }) +
          ", " +
          new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
      }),
    });
    if (res.ok) {
      const scene = await res.json();
      router.push(`/${spaceSlug}/scene/${scene.short_id}`);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1 px-4 py-6 md:px-6 md:py-8 pb-20 md:pb-8 max-w-5xl mx-auto w-full">
        <button
          onClick={() => router.push("/spaces")}
          className="mb-4 flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Spaces
        </button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">{space?.name ?? "Loading..."}</h1>
            {space?.description && (
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{space.description}</p>
            )}
          </div>
          <Button size="sm" onClick={createScene}>
            <Plus size={16} />
            New Scene
          </Button>
        </div>

        {scenesLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}

        {!scenesLoading && !scenes?.length && (
          <EmptyState
            icon={<Image size={40} />}
            title="No scenes yet"
            description="Create a scene to start generating 3D worlds."
            action={<Button onClick={createScene}><Plus size={16} /> Create Scene</Button>}
          />
        )}

        {scenes && scenes.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {scenes.map((scene) => (
              <motion.div
                key={scene.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push(`/${spaceSlug}/scene/${scene.short_id}`)}
                className="glow-border bg-[var(--bg-surface)] p-4 cursor-pointer"
              >
                <h3 className="font-medium">{scene.name}</h3>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${
                    scene.status === "completed" ? "bg-[var(--success)]" :
                    scene.status === "generating" ? "bg-[var(--accent-primary)] animate-pulse" :
                    scene.status === "failed" ? "bg-[var(--error)]" :
                    "bg-[var(--text-muted)]"
                  }`} />
                  <span className="text-xs text-[var(--text-muted)] capitalize">{scene.status}</span>
                </div>
                {scene.prompt && (
                  <p className="mt-2 text-xs text-[var(--text-secondary)] line-clamp-2">{scene.prompt}</p>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}
