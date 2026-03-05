"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus, FolderOpen } from "lucide-react";
import { motion } from "framer-motion";
import { AppHeader } from "@/components/layout/app-header";
import { SpaceCard } from "@/components/space/space-card";
import { CreateSpaceDialog } from "@/components/space/create-space-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { SpaceRow } from "@/lib/supabase/types";

export default function SpacesPage() {
  const { data: spaces, isLoading } = useQuery<SpaceRow[]>({
    queryKey: ["spaces"],
    queryFn: async () => {
      const res = await fetch("/api/spaces");
      if (!res.ok) throw new Error("Failed to fetch spaces");
      return res.json();
    },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1 px-4 py-6 md:px-6 md:py-8 pb-20 md:pb-8 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Spaces</h1>
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
              <SpaceCard key={space.id} space={space} />
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}
