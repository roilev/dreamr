"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

export type Platform = "desktop" | "mobile" | "xr";

interface PlatformInfo {
  platform: Platform;
  isMobile: boolean;
  isXRSupported: boolean;
  hasTouch: boolean;
  hasGyroscope: boolean;
  hasPointerLock: boolean;
  hasDeviceOrientation: boolean;
  isQuest: boolean;
  requestGyroscopePermission: () => Promise<boolean>;
}

const QUEST_UA_PATTERN = /Quest|Pacific/i;

async function requestGyroscopePermission(): Promise<boolean> {
  if (
    typeof DeviceOrientationEvent !== "undefined" &&
    "requestPermission" in DeviceOrientationEvent
  ) {
    try {
      const permission = await (
        DeviceOrientationEvent as unknown as {
          requestPermission: () => Promise<string>;
        }
      ).requestPermission();
      return permission === "granted";
    } catch {
      return false;
    }
  }
  return true;
}

export function usePlatform(): PlatformInfo {
  const [info, setInfo] = useState<Omit<PlatformInfo, "requestGyroscopePermission">>({
    platform: "desktop",
    isMobile: false,
    isXRSupported: false,
    hasTouch: false,
    hasGyroscope: false,
    hasPointerLock: false,
    hasDeviceOrientation: false,
    isQuest: false,
  });

  useEffect(() => {
    const ua = navigator.userAgent;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const hasPointerLock = "pointerLockElement" in document;
    const hasDeviceOrientation = "DeviceOrientationEvent" in window;
    const isQuest = QUEST_UA_PATTERN.test(ua);

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
      hasGyroscope: hasDeviceOrientation,
      hasPointerLock,
      hasDeviceOrientation,
      isQuest,
    });
  }, []);

  return useMemo(
    () => ({ ...info, requestGyroscopePermission }),
    [info],
  );
}
