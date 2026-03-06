"use client";

import { XROrigin } from "@react-three/xr";

import type { ViewerMode } from "@/lib/types/stores";

interface XRCameraRigProps {
  mode: ViewerMode;
}

export function XRCameraRig({ mode }: XRCameraRigProps) {
  const position: [number, number, number] =
    mode === "splat" ? [0, 1.6, 0] : [0, 0, 0];

  return <XROrigin position={position} />;
}
