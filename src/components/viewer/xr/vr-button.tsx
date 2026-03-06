"use client";

import { usePlatform } from "@/hooks/use-platform";
import { useViewerStore } from "@/lib/stores/viewer-store";
import { cn } from "@/lib/utils/cn";
import { Headset } from "lucide-react";
import { xrStore } from "./xr-provider";

export function VRButton() {
  const { isXRSupported } = usePlatform();
  const isXRActive = useViewerStore((s) => s.isXRActive);

  if (!isXRSupported) return null;

  const handleClick = () => {
    if (isXRActive) {
      xrStore.getState().session?.end();
    } else {
      xrStore.enterVR();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "absolute top-4 right-4 z-30 flex items-center gap-2 rounded-full px-4 py-2",
        "backdrop-blur-sm border transition-all duration-200",
        isXRActive
          ? "bg-[var(--accent-primary)]/20 border-[var(--accent-primary)]/40 text-[var(--accent-primary)]"
          : "bg-[var(--bg-secondary)]/80 border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]",
      )}
    >
      <Headset size={16} />
      <span className="text-xs font-medium">
        {isXRActive ? "Exit VR" : "Enter VR"}
      </span>
    </button>
  );
}
