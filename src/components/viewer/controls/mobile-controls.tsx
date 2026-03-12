"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Euler, Quaternion, MathUtils } from "three";
import { createPortal } from "react-dom";

import type { ViewerMode } from "@/lib/types/stores";
import { cn } from "@/lib/utils/cn";

const SPHERE_MODES: ViewerMode[] = ["equirect", "video", "depth"];
const DEG2RAD = Math.PI / 180;

interface MobileControlsProps {
  mode: ViewerMode;
}

// ── Gyroscope Permission ──

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

// ── Gyroscope Camera Control ──

const _euler = new Euler();
const _quat = new Quaternion();
const _targetQuat = new Quaternion();

function GyroscopeControl({ enabled }: { enabled: boolean }) {
  const { camera } = useThree();
  const initialOrientation = useRef<{
    alpha: number;
    beta: number;
    gamma: number;
  } | null>(null);
  const currentOrientation = useRef<{
    alpha: number;
    beta: number;
    gamma: number;
  } | null>(null);

  useEffect(() => {
    if (!enabled) {
      initialOrientation.current = null;
      currentOrientation.current = null;
      return;
    }

    function handler(e: DeviceOrientationEvent) {
      if (e.alpha === null || e.beta === null || e.gamma === null) return;

      if (!initialOrientation.current) {
        initialOrientation.current = {
          alpha: e.alpha,
          beta: e.beta!,
          gamma: e.gamma!,
        };
      }

      currentOrientation.current = {
        alpha: e.alpha,
        beta: e.beta!,
        gamma: e.gamma!,
      };
    }

    window.addEventListener("deviceorientation", handler);
    return () => {
      window.removeEventListener("deviceorientation", handler);
    };
  }, [enabled]);

  useFrame(() => {
    if (!enabled || !initialOrientation.current || !currentOrientation.current)
      return;

    const init = initialOrientation.current;
    const curr = currentOrientation.current;

    let deltaAlpha = (curr.alpha - init.alpha) * DEG2RAD;
    let deltaBeta = (curr.beta - init.beta) * DEG2RAD;

    // Wrap alpha delta to -PI..PI
    if (deltaAlpha > Math.PI) deltaAlpha -= 2 * Math.PI;
    if (deltaAlpha < -Math.PI) deltaAlpha += 2 * Math.PI;

    // Clamp pitch to avoid flipping
    deltaBeta = MathUtils.clamp(deltaBeta, -Math.PI / 3, Math.PI / 3);

    _euler.set(-deltaBeta, -deltaAlpha, 0, "YXZ");
    _targetQuat.setFromEuler(_euler);

    camera.quaternion.slerp(_targetQuat, 0.1);
  });

  return null;
}

// ── Gyroscope Toggle Button (HTML overlay, rendered via portal) ──

function GyroscopeToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  if (!portalTarget) return null;

  return createPortal(
    <button
      onClick={onToggle}
      className={cn(
        "fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg backdrop-blur-sm transition-all",
        enabled
          ? "bg-[var(--accent-primary)] text-[var(--bg-primary)]"
          : "bg-white/15 text-[var(--text-secondary)] hover:bg-white/25",
      )}
      aria-label={enabled ? "Disable gyroscope" : "Enable gyroscope"}
    >
      <GyroscopeIcon />
      {enabled ? "Gyro ON" : "Gyro"}
    </button>,
    portalTarget,
  );
}

function GyroscopeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <ellipse cx="12" cy="12" rx="10" ry="4" />
      <ellipse cx="12" cy="12" rx="4" ry="10" />
    </svg>
  );
}

// ── Pinch-to-zoom FOV ──

const PINCH_MIN_FOV = 20;
const PINCH_MAX_FOV = 110;

function PinchFovZoom() {
  const { camera, gl, invalidate } = useThree();
  const lastDist = useRef(0);

  useEffect(() => {
    const el = gl.domElement;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastDist.current = Math.sqrt(dx * dx + dy * dy);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastDist.current > 0) {
        const ratio = lastDist.current / dist;
        const cam = camera as THREE.PerspectiveCamera;
        cam.fov = MathUtils.clamp(cam.fov * ratio, PINCH_MIN_FOV, PINCH_MAX_FOV);
        cam.updateProjectionMatrix();
        invalidate();
      }
      lastDist.current = dist;
    };
    const onTouchEnd = () => { lastDist.current = 0; };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [camera, gl, invalidate]);

  return null;
}

// ── Main Mobile Controls ──

export function MobileControls({ mode }: MobileControlsProps) {
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [gyroAvailable, setGyroAvailable] = useState(false);

  useEffect(() => {
    setGyroAvailable("DeviceOrientationEvent" in window);
  }, []);

  const handleGyroToggle = useCallback(async () => {
    if (gyroEnabled) {
      setGyroEnabled(false);
      return;
    }

    const granted = await requestGyroscopePermission();
    if (granted) {
      setGyroEnabled(true);
    }
  }, [gyroEnabled]);

  if (mode === "empty" || mode === "loading" || mode === "input_canvas") {
    return null;
  }

  const isSphere = SPHERE_MODES.includes(mode);

  return (
    <>
      {isSphere && (
        <>
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            rotateSpeed={-0.3}
            touches={{ ONE: 1, TWO: 2 }}
            target={[0, 0, 0]}
            enabled={!gyroEnabled}
          />
          <PinchFovZoom />
          <GyroscopeControl enabled={gyroEnabled} />
          {gyroAvailable && (
            <GyroscopeToggle
              enabled={gyroEnabled}
              onToggle={handleGyroToggle}
            />
          )}
        </>
      )}

      {mode === "splat" && (
        <>
          <OrbitControls
            enableZoom
            enablePan
            enableRotate
            touches={{ ONE: 1, TWO: 2 }}
            enabled={!gyroEnabled}
          />
          <GyroscopeControl enabled={gyroEnabled} />
          {gyroAvailable && (
            <GyroscopeToggle
              enabled={gyroEnabled}
              onToggle={handleGyroToggle}
            />
          )}
        </>
      )}
    </>
  );
}
