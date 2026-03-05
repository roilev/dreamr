"use client";

import { toast } from "sonner";
import { useRunStep, useGenerateWorld } from "@/hooks/use-fal";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { Button } from "@/components/ui/button";
// usePipelineStore still used by isStepRunning()
import { Video, ArrowUpCircle, Layers, Box, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { AssetRow } from "@/lib/supabase/types";
import type { GetSceneResponse } from "@/lib/types/api";

interface StepActionsProps {
  sceneId: string;
  scene: GetSceneResponse | undefined;
  floating?: boolean;
  onGenerationStarted?: (step: string) => void;
}

function hasAsset(assets: AssetRow[] | undefined, type: string): boolean {
  return !!assets?.some((a) => a.type === type);
}

function isStepRunning(step: string): boolean {
  const { jobs } = usePipelineStore.getState();
  return jobs.some((j) => j.step === step && (j.status === "running" || j.status === "pending"));
}

export function StepActions({ sceneId, scene, floating, onGenerationStarted }: StepActionsProps) {
  const runStep = useRunStep(sceneId);
  const generateWorld = useGenerateWorld(sceneId);
  const assets = scene?.assets;

  const hasImage = hasAsset(assets, "equirect_image");
  const hasVideo = hasAsset(assets, "video") || hasAsset(assets, "upscaled_video");
  const hasUpscaled = hasAsset(assets, "upscaled_video");
  const hasDepth = hasAsset(assets, "depth_map");
  const hasRawVideo = hasAsset(assets, "video");

  const equirectAsset = assets?.find((a) => a.type === "equirect_image");

  const busy = runStep.isPending || generateWorld.isPending;

  type StepEntry = {
    key: string;
    icon: typeof Video;
    label: string;
    visible: boolean;
    running: boolean;
    onClick: () => void;
  };

  const steps: StepEntry[] = [
    {
      key: "video",
      icon: Video,
      label: "Generate Video",
      visible: hasImage && !hasVideo,
      running: isStepRunning("video"),
      onClick: () =>
        runStep.mutate(
          { step: "video" },
          {
            onSuccess: () => { toast.success("Video generation started"); onGenerationStarted?.("video"); },
            onError: (e) =>
              toast.error(e.message, {
                action: { label: "Retry", onClick: () => runStep.mutate({ step: "video" }) },
              }),
          },
        ),
    },
    {
      key: "upscale",
      icon: ArrowUpCircle,
      label: "Upscale Video",
      visible: hasRawVideo && !hasUpscaled,
      running: isStepRunning("upscale"),
      onClick: () =>
        runStep.mutate(
          { step: "upscale" },
          {
            onSuccess: () => { toast.success("Video upscale started"); onGenerationStarted?.("upscale"); },
            onError: (e) =>
              toast.error(e.message, {
                action: { label: "Retry", onClick: () => runStep.mutate({ step: "upscale" }) },
              }),
          },
        ),
    },
    {
      key: "depth",
      icon: Layers,
      label: "Generate Depth",
      visible: hasImage && !hasDepth,
      running: isStepRunning("depth"),
      onClick: () =>
        runStep.mutate(
          { step: "depth" },
          {
            onSuccess: () => { toast.success("Depth generation started"); onGenerationStarted?.("depth"); },
            onError: (e) =>
              toast.error(e.message, {
                action: { label: "Retry", onClick: () => runStep.mutate({ step: "depth" }) },
              }),
          },
        ),
    },
    {
      key: "world",
      icon: Box,
      label: "Generate 3D World",
      visible: hasImage && !!equirectAsset,
      running: generateWorld.isPending,
      onClick: () =>
        generateWorld.mutate(
          { frameAssetId: equirectAsset!.id },
          {
            onSuccess: () => { toast.success("3D world generation started"); onGenerationStarted?.("world"); },
            onError: (e) =>
              toast.error(e.message, {
                action: {
                  label: "Retry",
                  onClick: () => generateWorld.mutate({ frameAssetId: equirectAsset!.id }),
                },
              }),
          },
        ),
    },
  ];

  const visibleSteps = steps.filter((s) => s.visible);

  if (floating) {
    if (!visibleSteps.length && !hasImage) return null;

    return (
      <div className="bg-[var(--bg-elevated)]/80 backdrop-blur-sm rounded-xl border border-[var(--border-default)] p-1.5 flex flex-col gap-1">
        {visibleSteps.map((step) => {
          const Icon = step.icon;
          return (
            <button
              key={step.key}
              onClick={step.onClick}
              disabled={busy}
              title={step.label}
              className={cn(
                "relative group flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
                "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]",
                "disabled:opacity-30 disabled:cursor-not-allowed",
              )}
            >
              {step.running ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Icon size={16} />
              )}
              <span className="absolute right-full mr-2 whitespace-nowrap rounded-md bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--text-primary)] opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity border border-[var(--border-default)]">
                {step.label}
              </span>
            </button>
          );
        })}
        {!hasImage && (
          <div className="w-8 h-8 flex items-center justify-center" title="Generate a 360° image first">
            <Box size={16} className="text-[var(--text-muted)]" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-b border-[var(--border-default)] p-3">
      <span className="mb-2 block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
        Pipeline
      </span>
      <div className="flex flex-col gap-1.5">
        {visibleSteps.map((step) => {
          const Icon = step.icon;
          return (
            <Button
              key={step.key}
              variant="secondary"
              size="sm"
              onClick={step.onClick}
              disabled={busy}
              className="w-full justify-start"
            >
              {step.running ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Icon size={14} />
              )}
              {step.label}
            </Button>
          );
        })}
        {!hasImage && (
          <p className="text-xs text-[var(--text-muted)] py-1">
            Generate a 360° image to unlock pipeline steps
          </p>
        )}
      </div>
    </div>
  );
}
