"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ActiveGeneration {
  step: string;
  startedAt: number;
  baseAssetCount: number;
  baseJobCount: number;
}

interface JobData {
  id: string;
  step_name: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

const STEP_TO_ASSET: Record<string, string[]> = {
  image_360: ["equirect_image"],
  video: ["video"],
  upscale: ["upscaled_video"],
  depth: ["depth_map"],
  world: ["splat_100k", "splat_500k", "splat_full"],
};

const STEP_LABELS: Record<string, string> = {
  image_360: "360° image",
  video: "Video",
  upscale: "Upscale",
  depth: "Depth map",
  world: "3D world",
};

/**
 * Tracks multiple concurrent generation processes.
 * Polls the scene data until new assets appear, jobs complete, or jobs fail.
 * Surfaces failures via toast.
 */
export function useGenerationTracker(sceneId: string) {
  const [activeGens, setActiveGens] = useState<Map<string, ActiveGeneration>>(new Map());
  const queryClient = useQueryClient();
  const pollCountRef = useRef(0);

  const startTracking = useCallback(
    (step: string, currentAssetCount: number, currentJobCount = 0) => {
      setActiveGens((prev) => {
        const next = new Map(prev);
        next.set(step, {
          step,
          startedAt: Date.now(),
          baseAssetCount: currentAssetCount,
          baseJobCount: currentJobCount,
        });
        return next;
      });
      pollCountRef.current = 0;
    },
    [],
  );

  const stopTracking = useCallback((step?: string) => {
    if (step) {
      setActiveGens((prev) => {
        const next = new Map(prev);
        next.delete(step);
        return next;
      });
    } else {
      setActiveGens(new Map());
      pollCountRef.current = 0;
    }
  }, []);

  useEffect(() => {
    if (activeGens.size === 0) return;

    const poll = async () => {
      pollCountRef.current++;
      const result = (await queryClient.fetchQuery({
        queryKey: ["scene", sceneId],
        staleTime: 0,
      })) as {
        assets?: { type: string }[];
        jobs?: JobData[];
        status?: string;
      } | undefined;

      if (!result) return;

      const currentAssetCount = result.assets?.length ?? 0;
      const assetTypes = new Set(result.assets?.map((a) => a.type) ?? []);
      const jobs = (result.jobs ?? []) as JobData[];

      const resolved: string[] = [];
      const failed: { step: string; error: string }[] = [];

      for (const [step, gen] of activeGens) {
        const expectedAssets = STEP_TO_ASSET[step] ?? [];
        const hasNewAsset = expectedAssets.some((t) => assetTypes.has(t)) && currentAssetCount > gen.baseAssetCount;
        const timedOut = Date.now() - gen.startedAt > 600_000;

        const stepJobs = jobs.filter((j) => j.step_name === step);
        const newJobs = stepJobs.filter((j) => new Date(j.created_at).getTime() >= gen.startedAt - 5000);
        const failedJob = newJobs.find((j) => j.status === "failed");
        const completedJob = newJobs.find((j) => j.status === "completed");

        if (hasNewAsset || completedJob) {
          resolved.push(step);
        } else if (failedJob) {
          resolved.push(step);
          failed.push({
            step,
            error: failedJob.error_message || "Generation failed",
          });
        } else if (timedOut) {
          resolved.push(step);
          failed.push({ step, error: "Generation timed out" });
        }
      }

      if (resolved.length > 0) {
        for (const f of failed) {
          toast.error(`${STEP_LABELS[f.step] ?? f.step} failed`, {
            description: f.error,
            duration: 8000,
          });
        }

        setActiveGens((prev) => {
          const next = new Map(prev);
          for (const step of resolved) next.delete(step);
          return next;
        });
        queryClient.invalidateQueries({ queryKey: ["scene", sceneId] });
      }

      if (pollCountRef.current > 200) {
        setActiveGens(new Map());
      }
    };

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [activeGens, sceneId, queryClient]);

  const activeSteps = Array.from(activeGens.keys());

  return {
    activeSteps,
    isGenerating: activeGens.size > 0,
    generatingStep: activeSteps[0] ?? null,
    startTracking,
    stopTracking,
  };
}
