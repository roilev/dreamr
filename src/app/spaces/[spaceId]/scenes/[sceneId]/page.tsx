"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/layout/app-header";
import { SceneEditor, SceneName } from "@/components/scene/scene-editor";
import { useScene } from "@/hooks/use-scene";
import { useGenerationTracker } from "@/hooks/use-generation-tracker";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import type { SpaceRow } from "@/lib/supabase/types";

export default function SceneEditorPage({
  params,
}: {
  params: Promise<{ spaceId: string; sceneId: string }>;
}) {
  const { spaceId, sceneId } = use(params);

  const { data: space } = useQuery<SpaceRow>({
    queryKey: ["space", spaceId],
    queryFn: async () => {
      const res = await fetch(`/api/spaces/${spaceId}`);
      if (!res.ok) throw new Error("Failed to fetch space");
      return res.json();
    },
  });

  const { data: scene } = useScene(sceneId);
  const { activeSteps, startTracking, stopTracking, isGenerating } =
    useGenerationTracker(sceneId);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Canvas fills everything */}
      <div className="absolute inset-0">
        <ErrorBoundary>
          <SceneEditor
            sceneId={sceneId}
            spaceId={spaceId}
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
            spaceId={spaceId}
            sceneNameSlot={
              <SceneName
                sceneId={sceneId}
                name={scene?.name ?? "Untitled Scene"}
              />
            }
            overlay
            scene={scene}
            activeSteps={activeSteps}
          />
        </div>
      </div>
    </div>
  );
}
