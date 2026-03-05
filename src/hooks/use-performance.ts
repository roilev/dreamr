"use client";

import { useState, useEffect, useRef } from "react";

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsedMB: number | null;
  gpuTier: "low" | "medium" | "high";
  isLowPerformance: boolean;
}

export function usePerformance(): PerformanceMetrics {
  const gpuTier = useGPUTier();
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    frameTime: 16.67,
    memoryUsedMB: null,
    gpuTier,
    isLowPerformance: false,
  });

  useEffect(() => {
    setMetrics((prev) => ({ ...prev, gpuTier }));
  }, [gpuTier]);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let rafId: number;

    const measure = () => {
      frameCount++;
      const now = performance.now();
      const elapsed = now - lastTime;

      if (elapsed >= 1000) {
        const fps = Math.round((frameCount * 1000) / elapsed);
        const frameTime = Math.round((elapsed / frameCount) * 100) / 100;

        const memInfo = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
        const memoryUsedMB = memInfo
          ? Math.round(memInfo.usedJSHeapSize / 1024 / 1024)
          : null;

        setMetrics((prev) => ({
          fps,
          frameTime,
          memoryUsedMB,
          gpuTier: prev.gpuTier,
          isLowPerformance: fps < 30,
        }));

        frameCount = 0;
        lastTime = now;
      }

      rafId = requestAnimationFrame(measure);
    };

    rafId = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return metrics;
}

type GPUTier = "low" | "medium" | "high";

export function useGPUTier(): GPUTier {
  const [tier, setTier] = useState<GPUTier>("high");

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl) {
        setTier("low");
        return;
      }

      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      const renderer = debugInfo
        ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        : "";

      if (/Adreno.*7/i.test(renderer)) {
        setTier("medium");
      } else if (/Mali|Adreno.*[3-5]/i.test(renderer)) {
        setTier("low");
      } else if (/Apple/i.test(renderer)) {
        setTier("medium");
      } else if (/NVIDIA|AMD|Radeon|GeForce/i.test(renderer)) {
        setTier("high");
      } else {
        setTier("medium");
      }
    } catch {
      setTier("medium");
    }
  }, []);

  return tier;
}

export function useAdaptiveQuality() {
  const { fps, isLowPerformance } = usePerformance();
  const gpuTier = useGPUTier();
  const [quality, setQuality] = useState<GPUTier>("high");
  const lowFrameCount = useRef(0);

  useEffect(() => {
    setQuality(gpuTier);
  }, [gpuTier]);

  useEffect(() => {
    if (isLowPerformance) {
      lowFrameCount.current++;
      if (lowFrameCount.current > 3) {
        setQuality((prev) => (prev === "high" ? "medium" : "low"));
        lowFrameCount.current = 0;
      }
    } else {
      lowFrameCount.current = 0;
    }
  }, [fps, isLowPerformance]);

  return { quality, gpuTier, fps };
}
