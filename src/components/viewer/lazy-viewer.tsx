"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

function ViewerLoadingFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--bg-primary)]">
      <div className="flex flex-col items-center gap-3">
        <Loader2
          className="animate-spin text-[var(--accent-primary)]"
          size={24}
        />
        <span className="text-xs text-[var(--text-muted)]">
          Loading 3D viewer...
        </span>
      </div>
    </div>
  );
}

export const LazySplatWorld = dynamic(
  () => import("./splat-world").then((m) => ({ default: m.SplatWorld })),
  {
    loading: () => <ViewerLoadingFallback />,
    ssr: false,
  },
);

export const LazyViewerCanvas = dynamic(
  () => import("./viewer-canvas").then((m) => ({ default: m.ViewerCanvas })),
  {
    loading: () => <ViewerLoadingFallback />,
    ssr: false,
  },
);

export const LazyXRProvider = dynamic(
  () => import("./xr").then((m) => ({ default: m.XRProvider })),
  { ssr: false },
);

export const LazyVRButton = dynamic(
  () => import("./xr").then((m) => ({ default: m.VRButton })),
  { ssr: false },
);

export const LazyXRCameraRig = dynamic(
  () => import("./xr").then((m) => ({ default: m.XRCameraRig })),
  { ssr: false },
);
