"use client";

import { useState, useEffect } from "react";
import { Sparkles, Loader2, FileImage, X } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useUpdateScene } from "@/hooks/use-scene";
import { useRunStep } from "@/hooks/use-fal";
import { useQueryClient } from "@tanstack/react-query";
import type { SceneInputRow } from "@/lib/supabase/types";

interface PromptBarProps {
  sceneId: string;
  initialPrompt?: string;
  hasInputImages?: boolean;
  imageInputs?: SceneInputRow[];
  disabled?: boolean;
  onGenerationStarted?: (step: string) => void;
}

export function PromptBar({
  sceneId,
  initialPrompt,
  hasInputImages,
  imageInputs,
  disabled,
  onGenerationStarted,
}: PromptBarProps) {
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const updateScene = useUpdateScene(sceneId);
  const runStep = useRunStep(sceneId);
  const queryClient = useQueryClient();

  useEffect(() => {
    setPrompt(initialPrompt ?? "");
  }, [initialPrompt]);

  const isLoading = updateScene.isPending || runStep.isPending;
  const canSubmit = (prompt.trim() || hasInputImages) && !isLoading && !disabled;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    try {
      if (prompt.trim()) {
        await updateScene.mutateAsync({ prompt: prompt.trim() });
      }
      runStep.mutate(
        { step: "image_360" },
        {
          onSuccess: () => {
            toast.success("360° image generation started");
            onGenerationStarted?.("image_360");
          },
          onError: (e) =>
            toast.error(e.message, {
              action: { label: "Retry", onClick: handleSubmit },
            }),
        },
      );
    } catch {
      toast.error("Failed to update scene prompt");
    }
  };

  const removeInput = async (inputId: string) => {
    await fetch(`/api/scenes/${sceneId}/inputs/${inputId}`, { method: "DELETE" }).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ["scene", sceneId] });
  };

  const images = imageInputs ?? [];

  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="prompt-bar"
    >
      {images.length > 0 && (
        <div className="flex items-center gap-1.5 mb-2 px-0.5">
          {images.map((input) => {
            const thumbUrl = input.storage_path
              ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/scene-inputs/${input.storage_path}`
              : null;
            return (
              <div
                key={input.id}
                className="group relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)]"
              >
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[var(--text-muted)]">
                    <FileImage size={14} />
                  </div>
                )}
                <button
                  onClick={() => removeInput(input.id)}
                  className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-[var(--error)] text-white group-hover:flex"
                >
                  <X size={8} />
                </button>
              </div>
            );
          })}
          <span className="text-[10px] text-[var(--text-muted)] ml-1">
            {images.length} ref{images.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}
      <div className="flex items-center gap-3">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmit()}
          placeholder={
            hasInputImages
              ? "Optional: describe the world (or generate from images alone)..."
              : "Describe your world..."
          }
          disabled={disabled || isLoading}
          className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
        />
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex h-9 items-center gap-2 rounded-full bg-[var(--accent-primary)] px-4 text-sm font-medium text-white transition-all hover:bg-[var(--accent-primary)]/80 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          <span>Generate</span>
        </button>
      </div>
    </motion.div>
  );
}
