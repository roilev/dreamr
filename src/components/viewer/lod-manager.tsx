"use client";

import { useViewerStore } from "@/lib/stores/viewer-store";
import { useAdaptiveQuality } from "@/hooks/use-performance";

interface LODLevel {
  key: string;
  url: string | null;
  splatCount: "100k" | "500k" | "full";
  minGPUTier: "low" | "medium" | "high";
}

export function useSplatLOD() {
  const splatUrls = useViewerStore((s) => s.splatUrls);
  const { quality, gpuTier, fps } = useAdaptiveQuality();

  const levels: LODLevel[] = [
    { key: "100k", url: splatUrls.url100k, splatCount: "100k", minGPUTier: "low" },
    { key: "500k", url: splatUrls.url500k, splatCount: "500k", minGPUTier: "medium" },
    { key: "full", url: splatUrls.urlFull, splatCount: "full", minGPUTier: "high" },
  ];

  const targetLevel =
    quality === "low" ? "100k" : quality === "medium" ? "500k" : "full";

  const available = levels.filter((l) => l.url);
  const target =
    available.find((l) => l.key === targetLevel) ??
    available[available.length - 1] ??
    null;

  return {
    currentLevel: target,
    allLevels: levels,
    quality,
    gpuTier,
    fps,
    isAdapting: quality !== gpuTier,
  };
}

export function LODManager() {
  useSplatLOD();
  return null;
}
