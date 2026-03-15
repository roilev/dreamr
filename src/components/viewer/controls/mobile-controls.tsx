"use client";

import { useRef, useEffect } from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Euler, Quaternion, MathUtils } from "three";

import type { ViewerMode } from "@/lib/types/stores";
import { useViewerStore } from "@/lib/stores/viewer-store";

const SPHERE_MODES: ViewerMode[] = ["equirect", "video", "depth"];
const DEG2RAD = Math.PI / 180;

interface MobileControlsProps {
  mode: ViewerMode;
}

const _euler = new Euler();
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

    if (deltaAlpha > Math.PI) deltaAlpha -= 2 * Math.PI;
    if (deltaAlpha < -Math.PI) deltaAlpha += 2 * Math.PI;

    deltaBeta = MathUtils.clamp(deltaBeta, -Math.PI / 3, Math.PI / 3);

    _euler.set(-deltaBeta, -deltaAlpha, 0, "YXZ");
    _targetQuat.setFromEuler(_euler);

    camera.quaternion.slerp(_targetQuat, 0.1);
  });

  return null;
}

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

export function MobileControls({ mode }: MobileControlsProps) {
  const gyroEnabled = useViewerStore((s) => s.gyroEnabled);

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
        </>
      )}
    </>
  );
}
