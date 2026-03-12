"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useScene, useUpdateScene } from "@/hooks/use-scene";
import { useSceneStore } from "@/lib/stores/scene-store";
import { useViewerStore } from "@/lib/stores/viewer-store";
import { useQueryClient } from "@tanstack/react-query";
import { ControlCenter } from "./control-center";
import { FrameSelector, type CapturedFrame } from "./frame-selector";
import { LazyViewerCanvas as ViewerCanvas } from "@/components/viewer/lazy-viewer";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Loader2, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { useSceneWorld } from "@/hooks/use-world";
import { ModeTransition } from "@/components/viewer/mode-transition";
import { detectEquirectangular } from "@/lib/utils/detect-equirect";
import type { SceneInputRow } from "@/lib/supabase/types";
import type { ViewerInputImage } from "@/lib/types/stores";

function SceneName({ sceneId, name }: { sceneId: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateScene = useUpdateScene(sceneId);

  useEffect(() => setValue(name), [name]);

  const save = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) {
      updateScene.mutate({ name: trimmed });
    } else {
      setValue(name);
    }
    setEditing(false);
  }, [value, name, updateScene]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setValue(name);
            setEditing(false);
          }
        }}
        onBlur={save}
        autoFocus
        className="h-7 rounded-md border border-white/20 bg-white/5 px-2 text-[13px] uppercase tracking-wide font-semibold text-white outline-none focus:border-white/40"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-[13px] uppercase tracking-wide font-semibold text-white/90 hover:text-white/60 transition-colors truncate max-w-[260px]"
    >
      {name}
    </button>
  );
}

function resetViewerForScene() {
  const vs = useViewerStore.getState();
  vs.setMode("empty");
  vs.setEquirectUrl(null);
  vs.setVideoUrl(null);
  vs.setDepthUrl(null);
  vs.setSplatUrls({ url100k: null, url500k: null, urlFull: null });
  vs.setColliderUrl(null);
  vs.setActiveWorld(null);
  vs.setAssets([]);
  vs.setInputImages([]);
  vs.setInitialLookLongitude(null);
}

function inputPublicUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/scene-inputs/${storagePath}`;
}

function inputsToViewerImages(inputs: SceneInputRow[]): ViewerInputImage[] {
  return inputs
    .filter((i) => i.type === "image" && i.storage_path)
    .map((i) => {
      const lng = i.position_x ?? 0;
      const lat = i.position_y ?? 0;
      const size = i.position_z ?? 0;
      const isDefault = lng === 0 && lat === 0 && size === 0;
      return {
        id: i.id,
        url: inputPublicUrl(i.storage_path!),
        longitude: lng,
        latitude: lat,
        angularSize: isDefault ? 60 : size,
        needsPlacement: isDefault,
      };
    });
}

function hydrateViewerFromAssets(
  assets: { type: string; public_url: string | null }[],
  inputs: SceneInputRow[],
) {
  const vs = useViewerStore.getState();
  vs.setAssets(assets as never);

  const equirect = assets.find((a) => a.type === "equirect_image");
  const video =
    assets.find((a) => a.type === "upscaled_video") ??
    assets.find((a) => a.type === "video");
  const depth = assets.find((a) => a.type === "depth_map");

  const splat100k = assets.find((a) => a.type === "splat_100k");
  const splat500k = assets.find((a) => a.type === "splat_500k");
  const splatFull = assets.find((a) => a.type === "splat_full");
  const collider = assets.find((a) => a.type === "collider_mesh");

  if (equirect?.public_url) vs.setEquirectUrl(equirect.public_url);
  if (video?.public_url) vs.setVideoUrl(video.public_url);
  if (depth?.public_url) vs.setDepthUrl(depth.public_url);

  if (splat100k?.public_url || splat500k?.public_url || splatFull?.public_url) {
    vs.setSplatUrls({
      url100k: splat100k?.public_url ?? null,
      url500k: splat500k?.public_url ?? null,
      urlFull: splatFull?.public_url ?? null,
    });
  }
  if (collider?.public_url) vs.setColliderUrl(collider.public_url);

  const freshImages = inputsToViewerImages(inputs);
  const existing = vs.inputImages;
  const existingById = new Map(existing.map((img) => [img.id, img]));

  const merged = freshImages.map((fresh) => {
    const prev = existingById.get(fresh.id);
    if (prev && !prev.needsPlacement) return prev;
    return fresh;
  });

  vs.setInputImages(merged);

  if (equirect?.public_url) {
    if (merged.length > 0) {
      const avgLng =
        merged.reduce((sum, img) => sum + img.longitude, 0) / merged.length;
      vs.setInitialLookLongitude(avgLng);
    } else {
      vs.setInitialLookLongitude(null);
    }
    vs.setMode("equirect");
  } else if (merged.length > 0) {
    vs.setMode("input_canvas");
  }
}

export { SceneName };

export function SceneEditor({
  sceneId,
  spaceId,
  spaceName,
  activeSteps,
  startTracking,
  stopTracking,
  isGenerating,
}: {
  sceneId: string;
  spaceId?: string;
  spaceName?: string;
  activeSteps: string[];
  startTracking: (step: string, baseAssetCount: number, baseJobCount?: number) => void;
  stopTracking: () => void;
  isGenerating: boolean;
}) {
  const { data: scene, isLoading } = useScene(sceneId);
  const { data: worldData } = useSceneWorld(sceneId);
  const { setScene } = useSceneStore();
  const { mode, videoUrl } = useViewerStore();
  const queryClient = useQueryClient();
  const [capturedFrames, setCapturedFrames] = useState<CapturedFrame[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const prevGeneratingRef = useRef(false);

  useEffect(() => {
    if (prevGeneratingRef.current && !isGenerating) {
      toast.success("Generation complete");
    }
    prevGeneratingRef.current = isGenerating;
  }, [isGenerating]);

  useEffect(() => {
    resetViewerForScene();
    setCapturedFrames([]);
    stopTracking();
  }, [sceneId, stopTracking]);

  useEffect(() => {
    if (scene) {
      setScene(scene);
      const inputs: SceneInputRow[] = scene.inputs ?? [];
      hydrateViewerFromAssets(scene.assets ?? [], inputs);
    }
    return () => {
      setScene(null);
    };
  }, [scene, setScene]);

  useEffect(() => {
    if (!worldData) return;
    const vs = useViewerStore.getState();
    vs.setSplatUrls({
      url100k: worldData.splat100kUrl,
      url500k: worldData.splat500kUrl,
      urlFull: worldData.splatFullUrl,
    });
    vs.setColliderUrl(worldData.colliderUrl);
    vs.setActiveWorld(worldData);
    if (worldData.splatFullUrl || worldData.splat100kUrl) {
      vs.setMode("splat");
    }
  }, [worldData]);

  const handleCaptureFrame = useCallback(
    (blob: Blob, timeSeconds: number) => {
      const thumbnailUrl = URL.createObjectURL(blob);
      setCapturedFrames((prev) => [
        ...prev,
        { id: `frame-${Date.now()}`, blob, thumbnailUrl, timeSeconds },
      ]);
    },
    [],
  );

  const handleRemoveFrame = useCallback((id: string) => {
    setCapturedFrames((prev) => {
      const frame = prev.find((f) => f.id === id);
      if (frame) URL.revokeObjectURL(frame.thumbnailUrl);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const handleCanvasDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (!files.length) return;

      setUploadingCount(files.length);

      let successCount = 0;
      let equirectCount = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const detection = await detectEquirectangular(file);
          const uploadTarget = detection.isEquirect
            ? (detection.normalizedFile ?? file)
            : file;
          const bucket = detection.isEquirect ? "generated-assets" : "scene-inputs";
          const path = `${sceneId}/${Date.now()}-${file.name}`;

          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: file.name,
              contentType: uploadTarget.type,
              bucket,
              path,
            }),
          });
          if (!uploadRes.ok) throw new Error("Upload failed");
          const { signedUrl, storagePath } = await uploadRes.json();
          await fetch(signedUrl, {
            method: "PUT",
            headers: { "Content-Type": uploadTarget.type },
            body: uploadTarget,
          });

          if (detection.isEquirect) {
            const assetRes = await fetch(`/api/scenes/${sceneId}/assets`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "equirect_image",
                storage_path: storagePath,
                width: detection.width,
                height: detection.height,
              }),
            });
            if (!assetRes.ok) throw new Error("Failed to create equirect asset");
            equirectCount++;
          } else {
            await fetch(`/api/scenes/${sceneId}/inputs`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "image",
                storage_path: storagePath,
                sort_order: i,
              }),
            });
          }
          successCount++;
        } catch {
          toast.error(`Failed to upload "${file.name}"`);
        } finally {
          setUploadingCount((prev) => prev - 1);
        }
      }

      if (successCount > 0) {
        if (equirectCount > 0) {
          toast.success("360° image detected — projecting as panorama");
        } else {
          toast.success(
            `${successCount} image${successCount > 1 ? "s" : ""} added`,
          );
        }
        await queryClient.invalidateQueries({ queryKey: ["scene", sceneId] });
      }
    },
    [sceneId, queryClient],
  );

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2
          className="animate-spin text-[var(--text-muted)]"
          size={24}
        />
      </div>
    );
  }

  const inputs: SceneInputRow[] =
    (scene as { inputs?: SceneInputRow[] })?.inputs ?? [];
  const imageInputs = inputs.filter((i) => i.type === "image");
  const showTimeline = mode === "video" && videoUrl;

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden",
        dragOver && "ring-2 ring-inset ring-[var(--accent-secondary)]",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleCanvasDrop}
    >
      {/* Canvas — fills entire area */}
      <div className="absolute inset-0">
        <ErrorBoundary>
          <ModeTransition mode={mode}>
            <ViewerCanvas mode={mode} />
          </ModeTransition>
        </ErrorBoundary>
      </div>

      {/* Overlays */}
      {dragOver && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--bg-primary)]/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-[var(--text-secondary)]">
            <ImagePlus size={32} />
            <span className="text-sm font-medium">
              Drop image to add as reference
            </span>
          </div>
        </div>
      )}

      {uploadingCount > 0 && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--bg-primary)]/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2
              size={28}
              className="animate-spin text-[var(--text-secondary)]"
            />
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              Uploading {uploadingCount} image
              {uploadingCount > 1 ? "s" : ""}...
            </span>
          </div>
        </div>
      )}

      {capturedFrames.length > 0 && (
        <div className="absolute bottom-32 left-0 right-0 z-20">
          <FrameSelector
            sceneId={sceneId}
            frames={capturedFrames}
            onRemoveFrame={handleRemoveFrame}
          />
        </div>
      )}

      {/* Control Center — overlays bottom of canvas */}
      <div className="absolute inset-x-0 bottom-0 z-20 pointer-events-none">
        <div className="pointer-events-auto">
          <ControlCenter
            sceneId={sceneId}
            scene={scene}
            initialPrompt={scene?.prompt ?? ""}
            imageInputs={imageInputs}
            activeSteps={activeSteps}
            videoUrl={videoUrl}
            showTimeline={!!showTimeline}
            onGenerationStarted={(step) =>
              startTracking(step, scene?.assets?.length ?? 0, scene?.jobs?.length ?? 0)
            }
            onCaptureFrame={handleCaptureFrame}
          />
        </div>
      </div>
    </div>
  );
}
