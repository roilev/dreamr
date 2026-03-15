"use client";

import { use, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/layout/app-header";
import { SceneEditor, SceneName } from "@/components/scene/scene-editor";
import { ShareDialog } from "@/components/scene/share-dialog";
import { useScene } from "@/hooks/use-scene";
import { useGenerationTracker } from "@/hooks/use-generation-tracker";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import type { SpaceRow } from "@/lib/supabase/types";

export default function SceneEditorPage({
  params,
}: {
  params: Promise<{ spaceSlug: string; sceneSlug: string }>;
}) {
  const { spaceSlug, sceneSlug } = use(params);
  const [shareOpen, setShareOpen] = useState(false);

  const { data: space } = useQuery<SpaceRow>({
    queryKey: ["space", spaceSlug],
    queryFn: async () => {
      const res = await fetch(`/api/spaces/${spaceSlug}`);
      if (!res.ok) throw new Error("Failed to fetch space");
      return res.json();
    },
  });

  const { data: scene } = useScene(sceneSlug);
  const { activeSteps, startTracking, stopTracking, isGenerating, progress } =
    useGenerationTracker(sceneSlug);

  const handleShareOpen = useCallback(() => setShareOpen(true), []);

  return (
    <div className="relative w-screen overflow-hidden" style={{ height: "100dvh" }}>
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
            progress={progress}
            onShareOpen={handleShareOpen}
          />
        </ErrorBoundary>
      </div>

      {/* Header overlays the top */}
      <div className="absolute inset-x-0 top-0 z-40 pointer-events-none">
        <div className="pointer-events-auto">
          <AppHeader
            spaceName={space?.name}
            spaceId={spaceSlug}
            sceneNameSlot={
              <SceneName
                sceneId={sceneSlug}
                name={scene?.name ?? "Untitled Scene"}
              />
            }
            overlay
          />
        </div>
      </div>

      {scene && (
        <ShareDialog
          sceneId={sceneSlug}
          sceneName={scene.name ?? "Untitled Scene"}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
