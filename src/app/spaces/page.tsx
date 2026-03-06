"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus, FolderOpen, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { AppHeader } from "@/components/layout/app-header";
import { SpaceCard } from "@/components/space/space-card";
import { CreateSpaceDialog } from "@/components/space/create-space-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/hooks/use-is-admin";
import type { SpaceRow } from "@/lib/supabase/types";

interface SpaceWithOwner extends SpaceRow {
  owner?: { email: string | null; display_name: string | null } | null;
}

export default function SpacesPage() {
  const { isAdmin } = useIsAdmin();

  const { data: spaces, isLoading } = useQuery<SpaceWithOwner[]>({
    queryKey: ["spaces", isAdmin ? "all" : "mine"],
    queryFn: async () => {
      const url = isAdmin ? "/api/spaces?all=true" : "/api/spaces";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch spaces");
      return res.json();
    },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1 px-4 py-6 md:px-6 md:py-8 pb-20 md:pb-8 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Spaces</h1>
            {isAdmin && (
              <span className="flex items-center gap-1.5 rounded-full bg-[var(--accent-primary)] text-[var(--bg-primary)] border border-[var(--accent-primary)] px-3 py-1 text-xs font-medium">
                <Shield size={12} />
                Admin View
              </span>
            )}
          </div>
          <CreateSpaceDialog>
            <Button size="sm">
              <Plus size={16} />
              New Space
            </Button>
          </CreateSpaceDialog>
        </div>

        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}

        {!isLoading && !spaces?.length && (
          <EmptyState
            icon={<FolderOpen size={40} />}
            title="No spaces yet"
            description="Create your first space to start building immersive 3D worlds."
            action={
              <CreateSpaceDialog>
                <Button>
                  <Plus size={16} />
                  Create Space
                </Button>
              </CreateSpaceDialog>
            }
          />
        )}

        {spaces && spaces.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {spaces.map((space) => (
              <SpaceCard key={space.id} space={space} owner={isAdmin ? space.owner : undefined} />
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}
