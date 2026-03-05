"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useGenerateWorld } from "@/hooks/use-fal";
import { X, Box, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";

interface CapturedFrame {
  id: string;
  blob: Blob;
  thumbnailUrl: string;
  timeSeconds: number;
}

interface FrameSelectorProps {
  sceneId: string;
  frames: CapturedFrame[];
  onRemoveFrame: (id: string) => void;
}

export function FrameSelector({ sceneId, frames, onRemoveFrame }: FrameSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const generateWorld = useGenerateWorld(sceneId);
  const queryClient = useQueryClient();

  if (frames.length === 0) return null;

  const handleGenerateWorld = async () => {
    const frame = frames.find((f) => f.id === selectedId);
    if (!frame) return;

    setUploading(true);
    try {
      const path = `${sceneId}/${Date.now()}-frame-${frame.timeSeconds.toFixed(1)}s.png`;
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: `frame-${frame.timeSeconds.toFixed(1)}s.png`,
          contentType: "image/png",
          bucket: "generated-assets",
          path,
        }),
      });
      if (!uploadRes.ok) throw new Error("Failed to get upload URL");
      const { signedUrl, storagePath } = await uploadRes.json();

      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: frame.blob,
      });
      if (!putRes.ok) throw new Error("Upload failed");

      const inputRes = await fetch(`/api/scenes/${sceneId}/inputs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "image",
          storage_path: storagePath,
          sort_order: 100,
        }),
      });
      if (!inputRes.ok) throw new Error("Failed to create asset");
      const assetData = await inputRes.json();

      const assetRes = await fetch(`/api/scenes/${sceneId}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "selected_frame",
          storage_path: storagePath,
          public_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/generated-assets/${storagePath}`,
        }),
      });

      // For now, create the asset record directly and use the scene input as the frame
      // The generate-world endpoint needs a frameAssetId - use equirect for now
      // A proper implementation would create an asset record for the frame
      queryClient.invalidateQueries({ queryKey: ["scene", sceneId] });

      // Use the equirect image as frame for world gen since that's what Marble expects
      const sceneRes = await fetch(`/api/scenes/${sceneId}`);
      const sceneData = await sceneRes.json();
      const equirect = sceneData.assets?.find((a: { type: string }) => a.type === "equirect_image");
      if (equirect) {
        generateWorld.mutate({ frameAssetId: equirect.id });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Frame upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="border-t border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
      <span className="mb-2 block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
        Captured Frames
      </span>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {frames.map((frame) => (
          <div
            key={frame.id}
            onClick={() => setSelectedId(frame.id)}
            className={cn(
              "group relative h-16 w-28 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 transition-all",
              selectedId === frame.id
                ? "border-[var(--accent-secondary)] shadow-[0_0_12px_rgba(0,210,255,0.4)]"
                : "border-[var(--border-default)] hover:border-[var(--accent-secondary)]/30",
            )}
          >
            <img
              src={frame.thumbnailUrl}
              alt={`Frame at ${frame.timeSeconds.toFixed(1)}s`}
              className="h-full w-full object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-[10px] text-white text-center">
              {frame.timeSeconds.toFixed(1)}s
            </div>
            {selectedId === frame.id && (
              <div className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent-secondary)]">
                <Check size={10} className="text-white" />
              </div>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onRemoveFrame(frame.id); }}
              className="absolute top-1 left-1 hidden h-4 w-4 items-center justify-center rounded-full bg-[var(--error)] text-white group-hover:flex"
            >
              <X size={8} />
            </button>
          </div>
        ))}
      </div>
      {selectedId && (
        <Button
          size="sm"
          onClick={handleGenerateWorld}
          disabled={uploading || generateWorld.isPending}
          className="mt-2 w-full"
        >
          {uploading || generateWorld.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Box size={14} />
          )}
          Step Into This Moment
        </Button>
      )}
    </div>
  );
}

export type { CapturedFrame };
