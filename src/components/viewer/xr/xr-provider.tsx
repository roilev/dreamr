"use client";

import { createXRStore, XR } from "@react-three/xr";
import { useViewerStore } from "@/lib/stores/viewer-store";
import { useEffect } from "react";

export const xrStore = createXRStore({
  hand: { teleportPointer: true },
  controller: { teleportPointer: true },
  emulate: false,
  offerSession: false,
});

interface XRProviderProps {
  children: React.ReactNode;
}

export function XRProvider({ children }: XRProviderProps) {
  const setXRActive = useViewerStore((s) => s.setXRActive);

  useEffect(() => {
    const unsubscribe = xrStore.subscribe((state) => {
      setXRActive(!!state.session);
    });
    return unsubscribe;
  }, [setXRActive]);

  return <XR store={xrStore}>{children}</XR>;
}
