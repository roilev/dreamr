"use client";

import { usePlatform } from "@/hooks/use-platform";
import { useViewerStore } from "@/lib/stores/viewer-store";
import { DesktopControls } from "./desktop-controls";
import { MobileControls } from "./mobile-controls";
import type { ViewerMode } from "@/lib/types/stores";

interface PlatformControlsProps {
  mode: ViewerMode;
}

/**
 * Selects the appropriate camera/interaction controls based on the
 * detected platform. In XR sessions, controls are handled by
 * HandInteraction and TeleportLocomotion instead.
 */
export function PlatformControls({ mode }: PlatformControlsProps) {
  const { platform } = usePlatform();
  const isXRActive = useViewerStore((s) => s.isXRActive);

  if (isXRActive) return null;

  if (platform === "mobile") {
    return <MobileControls mode={mode} />;
  }

  return <DesktopControls mode={mode} />;
}
