"use client";

import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, X, Loader2, FileImage } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { SceneInputRow } from "@/lib/supabase/types";
import { useScene } from "@/hooks/use-scene";

async function uploadFile(
  file: File,
  sceneId: string,
): Promise<{ storagePath: string }> {
  const path = `${sceneId}/${Date.now()}-${file.name}`;

  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      bucket: "scene-inputs",
      path,
    }),
  });

  if (!res.ok) throw new Error("Failed to get upload URL");
  const { signedUrl, storagePath } = await res.json();

  const uploadRes = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!uploadRes.ok) throw new Error("Upload failed");
  return { storagePath };
}

async function addInput(
  sceneId: string,
  storagePath: string,
  sortOrder: number,
) {
  const res = await fetch(`/api/scenes/${sceneId}/inputs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "image",
      storage_path: storagePath,
      sort_order: sortOrder,
    }),
  });
  if (!res.ok) throw new Error("Failed to add input");
  return res.json();
}

export function InputPanel({ sceneId }: { sceneId: string }) {
  const { data: scene } = useScene(sceneId);
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const inputs: SceneInputRow[] = (scene as { inputs?: SceneInputRow[] })?.inputs ?? [];
  const imageInputs = inputs.filter((i) => i.type === "image");

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setUploading(true);
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (!file.type.startsWith("image/")) continue;
          const { storagePath } = await uploadFile(file, sceneId);
          await addInput(sceneId, storagePath, imageInputs.length + i);
        }
        queryClient.invalidateQueries({ queryKey: ["scene", sceneId] });
      } catch (err) {
        console.error("Upload failed:", err);
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [sceneId, imageInputs.length, queryClient],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const removeInput = async (inputId: string) => {
    await fetch(`/api/scenes/${sceneId}/inputs/${inputId}`, { method: "DELETE" }).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ["scene", sceneId] });
  };

  return (
    <div className="border-b border-[var(--border-default)] p-3">
      <span className="mb-2 block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
        Reference Images
      </span>

      {imageInputs.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {imageInputs.map((input) => (
            <div
              key={input.id}
              className="group relative h-14 w-14 overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)]"
            >
              <div className="flex h-full w-full items-center justify-center text-[var(--text-muted)]">
                <FileImage size={20} />
              </div>
              <button
                onClick={() => removeInput(input.id)}
                className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-[var(--error)] text-white group-hover:flex"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={cn(
          "flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-default)] px-3 py-3 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--text-secondary)]",
          uploading && "pointer-events-none opacity-50",
        )}
      >
        {uploading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <ImagePlus size={14} />
        )}
        <span>{uploading ? "Uploading..." : "Add reference images"}</span>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
