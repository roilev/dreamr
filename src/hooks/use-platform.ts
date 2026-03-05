"use client";

import { useState, useEffect } from "react";

export type Platform = "desktop" | "mobile" | "xr";

interface PlatformInfo {
  platform: Platform;
  isMobile: boolean;
  isXRSupported: boolean;
  hasTouch: boolean;
  hasGyroscope: boolean;
}

export function usePlatform(): PlatformInfo {
  const [info, setInfo] = useState<PlatformInfo>({
    platform: "desktop",
    isMobile: false,
    isXRSupported: false,
    hasTouch: false,
    hasGyroscope: false,
  });

  useEffect(() => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

    let isXRSupported = false;
    if ("xr" in navigator) {
      (navigator as Navigator & { xr: { isSessionSupported: (mode: string) => Promise<boolean> } })
        .xr.isSessionSupported("immersive-vr")
        .then((supported) => {
          isXRSupported = supported;
          setInfo((prev) => ({
            ...prev,
            isXRSupported: supported,
            platform: supported ? "xr" : prev.platform,
          }));
        })
        .catch(() => {});
    }

    setInfo({
      platform: isMobile ? "mobile" : "desktop",
      isMobile,
      isXRSupported,
      hasTouch,
      hasGyroscope: "DeviceOrientationEvent" in window,
    });
  }, []);

  return info;
}
