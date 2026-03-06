"use client";

import { use, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { SceneEditor, SceneName } from "@/components/scene/scene-editor";
import { AssetGallery } from "@/components/scene/asset-gallery";
import { GenerationHistory } from "@/components/scene/generation-history";
import { useScene } from "@/hooks/use-scene";
import { useGenerationTracker } from "@/hooks/use-generation-tracker";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import type { SpaceRow } from "@/lib/supabase/types";

type SidePanel = "assets" | "history" | null;

export default function SceneEditorPage({
  params,
}: {
  params: Promise<{ spaceSlug: string; sceneSlug: string }>;
}) {
  const { spaceSlug, sceneSlug } = use(params);
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);

  const { data: space } = useQuery<SpaceRow>({
    queryKey: ["space", spaceSlug],
    queryFn: async () => {
      const res = await fetch(`/api/spaces/${spaceSlug}`);
      if (!res.ok) throw new Error("Failed to fetch space");
      return res.json();
    },
  });

  const { data: scene } = useScene(sceneSlug);
  const { activeSteps, startTracking, stopTracking, isGenerating } =
    useGenerationTracker(sceneSlug);

  const handleOpenPanel = useCallback((panel: "assets" | "history") => {
    setSidePanel((prev) => (prev === panel ? null : panel));
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Canvas fills everything */}
      <div className="absolute inset-0">
        <ErrorBoundary>
          <SceneEditor
            sceneId={sceneSlug}
            spaceId={spaceSlug}
            spaceName={space?.name}
            activeSteps={activeSteps}
            startTracking={startTracking}
            stopTracking={stopTracking}
            isGenerating={isGenerating}
          />
        </ErrorBoundary>
      </div>

      {/* Header overlays the top */}
      <div className="absolute inset-x-0 top-0 z-40 pointer-events-none">
        <div className="pointer-events-auto">
          <AppHeader
            spaceName={space?.name}
            spaceId={spaceSlug}
            sceneId={sceneSlug}
            sceneNameSlot={
              <SceneName
                sceneId={sceneSlug}
                name={scene?.name ?? "Untitled Scene"}
              />
            }
            overlay
            scene={scene}
            activeSteps={activeSteps}
            onOpenPanel={handleOpenPanel}
          />
        </div>
      </div>

      {/* Side panel for Assets / History */}
      <AnimatePresence>
        {sidePanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 bg-black/30"
              onClick={() => setSidePanel(null)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="absolute right-0 top-0 bottom-0 z-50 w-full max-w-md border-l border-[var(--border-default)] bg-[var(--bg-primary)] shadow-2xl"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]">
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {sidePanel === "assets" ? "Asset Gallery" : "Generation History"}
                </span>
                <button
                  onClick={() => setSidePanel(null)}
                  className="rounded-lg p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="h-[calc(100%-52px)] overflow-hidden">
                {sidePanel === "assets" ? (
                  <AssetGallery
                    sceneId={sceneSlug}
                    onClose={() => setSidePanel(null)}
                  />
                ) : (
                  <GenerationHistory sceneId={sceneSlug} />
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
