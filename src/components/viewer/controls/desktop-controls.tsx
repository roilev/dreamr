"use client";

import { useRef, useEffect, useCallback } from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Euler, Quaternion, MathUtils, Vector3 } from "three";

import type { ViewerMode } from "@/lib/types/stores";
import { useViewerStore } from "@/lib/stores/viewer-store";

const SPHERE_MODES: ViewerMode[] = ["equirect", "video", "depth"];
const ARROW_ROTATE_SPEED = 0.8; // radians per second

interface DesktopControlsProps {
  mode: ViewerMode;
}

const _euler = new Euler();
const _quat = new Quaternion();

/**
 * Keyboard arrow rotation for sphere/panorama modes.
 * Applies smooth rotation while arrow keys are held.
 */
function ArrowKeyRotation() {
  const { camera } = useThree();
  const keys = useRef({ up: false, down: false, left: false, right: false });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowUp":
          keys.current.up = true;
          break;
        case "ArrowDown":
          keys.current.down = true;
          break;
        case "ArrowLeft":
          keys.current.left = true;
          break;
        case "ArrowRight":
          keys.current.right = true;
          break;
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowUp":
          keys.current.up = false;
          break;
        case "ArrowDown":
          keys.current.down = false;
          break;
        case "ArrowLeft":
          keys.current.left = false;
          break;
        case "ArrowRight":
          keys.current.right = false;
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    const k = keys.current;
    if (!k.up && !k.down && !k.left && !k.right) return;

    let yaw = 0;
    let pitch = 0;
    if (k.left) yaw += ARROW_ROTATE_SPEED * delta;
    if (k.right) yaw -= ARROW_ROTATE_SPEED * delta;
    if (k.up) pitch += ARROW_ROTATE_SPEED * delta;
    if (k.down) pitch -= ARROW_ROTATE_SPEED * delta;

    _euler.set(pitch, yaw, 0, "YXZ");
    _quat.setFromEuler(_euler);
    camera.quaternion.premultiply(_quat);
  });

  return null;
}

/**
 * Reset camera on "R" key press. Returns the camera to origin
 * looking forward for sphere modes, or to the default splat position.
 */
function ResetCameraOnKey({ mode }: { mode: ViewerMode }) {
  const { camera } = useThree();
  const setCamera = useViewerStore((s) => s.setCamera);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "r" && e.key !== "R") return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      const isSphere = SPHERE_MODES.includes(mode);
      const pos: [number, number, number] = isSphere
        ? [0, 0, 0]
        : [0, 1.6, 5];
      const target: [number, number, number] = isSphere
        ? [0, 0, -1]
        : [0, 0, 0];

      camera.position.set(...pos);
      camera.lookAt(...target);
      setCamera({ position: pos, target });
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [camera, mode, setCamera]);

  return null;
}

const MIN_FOV = 20;
const MAX_FOV = 110;
const ZOOM_SPEED = 0.05;

function FovZoom() {
  const { camera, gl, invalidate } = useThree();

  useEffect(() => {
    const el = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = camera as THREE.PerspectiveCamera;
      const delta = e.deltaY > 0 ? 1 : -1;
      cam.fov = MathUtils.clamp(cam.fov + delta * cam.fov * ZOOM_SPEED, MIN_FOV, MAX_FOV);
      cam.updateProjectionMatrix();
      invalidate();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [camera, gl, invalidate]);

  return null;
}

export function DesktopControls({ mode }: DesktopControlsProps) {
  const isSphere = SPHERE_MODES.includes(mode);

  if (mode === "empty" || mode === "loading" || mode === "input_canvas") {
    return null;
  }

  if (isSphere) {
    return (
      <>
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          rotateSpeed={-0.3}
          touches={{ ONE: 1, TWO: 2 }}
          target={[0, 0, 0]}
        />
        <FovZoom />
        <ArrowKeyRotation />
        <ResetCameraOnKey mode={mode} />
      </>
    );
  }

  // Splat mode: WASD fly controls live in splat-world.tsx, we just add reset
  return <ResetCameraOnKey mode={mode} />;
}
