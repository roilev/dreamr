"use client";

import { useRef, useEffect } from "react";
import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { MathUtils } from "three";

import type { ViewerMode } from "@/lib/types/stores";

const SPHERE_MODES: ViewerMode[] = ["equirect", "video", "depth"];

interface MobileControlsProps {
  mode: ViewerMode;
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
          />
          <PinchFovZoom />
        </>
      )}

      {mode === "splat" && (
        <OrbitControls
          enableZoom
          enablePan
          enableRotate
          touches={{ ONE: 1, TWO: 2 }}
        />
      )}
    </>
  );
}
