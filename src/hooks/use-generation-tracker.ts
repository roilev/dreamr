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
  step: string;
  status: string;
  error_message: string | null;
  created_at: string;
  output_metadata?: Record<string, unknown> | null;
}

export interface PipelineProgress {
  step: string;
  subStep: number;
  totalSubSteps: number;
  subStepLabel: string;
  elapsedMs: number;
}

const STEP_TO_ASSET: Record<string, string[]> = {
  image_360: ["equirect_image"],
  video: ["video"],
  upscale: ["upscaled_video"],
  depth: ["depth_map"],
  enhance: ["equirect_image", "depth_map"],
  world: ["splat_100k", "splat_500k", "splat_full"],
};

const STEP_LABELS: Record<string, string> = {
  image_360: "360° image",
  video: "Video",
  upscale: "Upscale",
  depth: "Depth map",
  enhance: "Enhance",
  world: "3D world",
};

const IMAGE_360_SUB_STEPS = [
  { key: "step_1_generate", label: "Generating image" },
  { key: "step_2_seam", label: "Fixing seams" },
  { key: "step_3_poles", label: "Filling poles" },
  { key: "step_4_finalize", label: "Finalizing" },
];

function detectSubStep(meta: Record<string, unknown> | null | undefined): { subStep: number; label: string } {
  if (!meta) return { subStep: 0, label: IMAGE_360_SUB_STEPS[0].label };
  for (let i = IMAGE_360_SUB_STEPS.length - 1; i >= 0; i--) {
    if (meta[IMAGE_360_SUB_STEPS[i].key]) {
      const next = i + 1;
      if (next < IMAGE_360_SUB_STEPS.length) {
        return { subStep: next, label: IMAGE_360_SUB_STEPS[next].label };
      }
      return { subStep: i, label: "Finalizing" };
    }
  }
  return { subStep: 0, label: IMAGE_360_SUB_STEPS[0].label };
}

/**
 * Tracks multiple concurrent generation processes.
 * Polls the scene data until new assets appear, jobs complete, or jobs fail.
 * Surfaces failures via toast.
 */
export function useGenerationTracker(sceneId: string) {
  const [activeGens, setActiveGens] = useState<Map<string, ActiveGeneration>>(new Map());
  const [progressMap, setProgressMap] = useState<Map<string, PipelineProgress>>(new Map());
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

      // Update sub-step progress for running jobs
      const newProgress = new Map<string, PipelineProgress>();
      for (const [step, gen] of activeGens) {
        if (step === "image_360") {
          const stepJobs = jobs.filter((j) => j.step === step && j.status === "running");
          const runningJob = stepJobs.find((j) => new Date(j.created_at).getTime() >= gen.startedAt - 5000);
          const { subStep, label } = detectSubStep(runningJob?.output_metadata);
          newProgress.set(step, {
            step,
            subStep,
            totalSubSteps: IMAGE_360_SUB_STEPS.length,
            subStepLabel: label,
            elapsedMs: Date.now() - gen.startedAt,
          });
        }
      }
      setProgressMap(newProgress);

      const resolved: string[] = [];
      const failed: { step: string; error: string }[] = [];

      for (const [step, gen] of activeGens) {
        const expectedAssets = STEP_TO_ASSET[step] ?? [];
        const hasNewAsset = expectedAssets.some((t) => assetTypes.has(t)) && currentAssetCount > gen.baseAssetCount;
        const timedOut = Date.now() - gen.startedAt > 600_000;

        const stepJobs = jobs.filter((j) => j.step === step);
        const newJobs = stepJobs.filter((j) => new Date(j.created_at).getTime() >= gen.startedAt - 5000);
        const failedJob = newJobs.find((j) => j.status === "failed");
        const completedJob = newJobs.find((j) => j.status === "completed");

        // When a job exists for this step, rely on its status rather than
        // asset-count heuristics (which can false-positive from parallel steps).
        if (completedJob) {
          resolved.push(step);
        } else if (failedJob) {
          resolved.push(step);
          failed.push({
            step,
            error: failedJob.error_message || "Generation failed",
          });
        } else if (newJobs.length === 0 && hasNewAsset) {
          resolved.push(step);
        } else if (timedOut) {
          resolved.push(step);
          failed.push({ step, error: "Generation timed out" });
        }
      }

      if (resolved.length > 0) {
        const failedSteps = new Set(failed.map((f) => f.step));
        for (const step of resolved) {
          if (!failedSteps.has(step)) {
            toast.success(`${STEP_LABELS[step] ?? step} complete`);
          }
        }
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
        queryClient.invalidateQueries({ queryKey: ["scene", sceneId] }, { cancelRefetch: false });
      }

      if (pollCountRef.current > 200) {
        setActiveGens(new Map());
      }
    };

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [activeGens, sceneId, queryClient]);

  const activeSteps = Array.from(activeGens.keys());
  const progress = activeSteps.length > 0 ? progressMap.get(activeSteps[0]) ?? null : null;

  return {
    activeSteps,
    isGenerating: activeGens.size > 0,
    generatingStep: activeSteps[0] ?? null,
    progress,
    progressMap,
    startTracking,
    stopTracking,
  };
}
