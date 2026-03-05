"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RunStepRequest, RunStepResponse, PipelineStepName } from "@/lib/types/api";

export function useRunStep(sceneId: string) {
  const queryClient = useQueryClient();

  return useMutation<RunStepResponse, Error, RunStepRequest>({
    mutationFn: async (data) => {
      const res = await fetch(`/api/scenes/${sceneId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Step failed" }));
        throw new Error(err.error);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scene", sceneId] });
    },
  });
}

export function useGenerateWorld(sceneId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ status: string }, Error, { frameAssetId?: string; imageUrl?: string }>({
    mutationFn: async (data) => {
      const res = await fetch(`/api/scenes/${sceneId}/generate-world`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "World generation failed" }));
        throw new Error(err.error);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scene", sceneId] });
    },
  });
}

export function useStepAction(sceneId: string, step: PipelineStepName) {
  const runStep = useRunStep(sceneId);
  return {
    run: (options?: RunStepRequest["options"]) => runStep.mutate({ step, options }),
    isPending: runStep.isPending,
    error: runStep.error,
  };
}
