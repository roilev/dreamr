"use client";

import { useRef, useCallback, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  useXRInputSourceState,
  XRSpace,
} from "@react-three/xr";
import type { XRHandState } from "@pmndrs/xr/internals";
import { Vector3, MathUtils, Euler, Quaternion } from "three";
import type { Group, Mesh } from "three";

import { useViewerStore } from "@/lib/stores/viewer-store";
import type { ViewerMode } from "@/lib/types/stores";

const PINCH_THRESHOLD = 0.025;
const PINCH_RELEASE_THRESHOLD = 0.04;

const SPHERE_MODES: ViewerMode[] = ["equirect", "video", "depth"];

interface PinchState {
  isPinching: boolean;
  startPosition: Vector3 | null;
  lastPosition: Vector3 | null;
}

function usePinchState() {
  return useRef<PinchState>({
    isPinching: false,
    startPosition: null,
    lastPosition: null,
  });
}

const _thumbTip = new Vector3();
const _indexTip = new Vector3();
const _midpoint = new Vector3();

/**
 * Calculates pinch distance from the hand pose Float32Array.
 * Each joint stores 16 floats (4x4 matrix). Thumb tip = joint 4, index tip = joint 9.
 * We extract the translation (elements 12,13,14) from each matrix.
 */
function getPinchDistance(poseData: Float32Array): number | null {
  if (poseData.length < 25 * 16) return null;

  const thumbOffset = 4 * 16;
  _thumbTip.set(
    poseData[thumbOffset + 12],
    poseData[thumbOffset + 13],
    poseData[thumbOffset + 14],
  );

  const indexOffset = 9 * 16;
  _indexTip.set(
    poseData[indexOffset + 12],
    poseData[indexOffset + 13],
    poseData[indexOffset + 14],
  );

  return _thumbTip.distanceTo(_indexTip);
}

function getPinchMidpoint(poseData: Float32Array): Vector3 | null {
  if (poseData.length < 25 * 16) return null;

  const thumbOffset = 4 * 16;
  _thumbTip.set(
    poseData[thumbOffset + 12],
    poseData[thumbOffset + 13],
    poseData[thumbOffset + 14],
  );

  const indexOffset = 9 * 16;
  _indexTip.set(
    poseData[indexOffset + 12],
    poseData[indexOffset + 13],
    poseData[indexOffset + 14],
  );

  return _midpoint.lerpVectors(_thumbTip, _indexTip, 0.5);
}

interface HandControllerProps {
  hand: "left" | "right";
}

const _euler = new Euler();
const _quat = new Quaternion();

function HandController({ hand }: HandControllerProps) {
  const handState = useXRInputSourceState("hand", hand);
  const mode = useViewerStore((s) => s.mode);
  const { camera } = useThree();

  const pinch = usePinchState();
  const feedbackRef = useRef<Mesh>(null);
  const [pinchStrength, setPinchStrength] = useState(0);

  const isSphereMode = SPHERE_MODES.includes(mode);

  useFrame(() => {
    if (!handState?.pose?.data) return;

    const distance = getPinchDistance(handState.pose.data);
    if (distance === null) return;

    const normalized = MathUtils.clamp(
      1 - (distance - PINCH_THRESHOLD) / (PINCH_RELEASE_THRESHOLD - PINCH_THRESHOLD),
      0,
      1,
    );
    setPinchStrength(normalized);

    const wasPinching = pinch.current.isPinching;
    const isPinching = wasPinching
      ? distance < PINCH_RELEASE_THRESHOLD
      : distance < PINCH_THRESHOLD;

    if (isPinching && !wasPinching) {
      const mid = getPinchMidpoint(handState.pose.data);
      if (mid) {
        pinch.current.startPosition = mid.clone();
        pinch.current.lastPosition = mid.clone();
      }
    }

    if (isPinching && pinch.current.lastPosition) {
      const mid = getPinchMidpoint(handState.pose.data);
      if (mid) {
        const delta = mid.clone().sub(pinch.current.lastPosition);

        if (isSphereMode) {
          const sensitivity = 2.0;
          _euler.set(
            -delta.y * sensitivity,
            -delta.x * sensitivity,
            0,
            "YXZ",
          );
          _quat.setFromEuler(_euler);
          camera.quaternion.premultiply(_quat);
        }

        pinch.current.lastPosition = mid.clone();
      }
    }

    if (!isPinching && wasPinching) {
      pinch.current.startPosition = null;
      pinch.current.lastPosition = null;
    }

    pinch.current.isPinching = isPinching;

    if (feedbackRef.current) {
      feedbackRef.current.scale.setScalar(
        MathUtils.lerp(0.003, 0.008, normalized),
      );
    }
  });

  if (!handState) return null;

  return (
    <>
      <XRSpace space="index-finger-tip">
        <mesh ref={feedbackRef}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial
            color={pinchStrength > 0.5 ? "#4fc3f7" : "#ffffff"}
            transparent
            opacity={MathUtils.lerp(0.2, 0.8, pinchStrength)}
          />
        </mesh>
      </XRSpace>
      <XRSpace space="thumb-tip">
        <mesh scale={0.004}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial
            color={pinchStrength > 0.5 ? "#4fc3f7" : "#ffffff"}
            transparent
            opacity={MathUtils.lerp(0.1, 0.6, pinchStrength)}
          />
        </mesh>
      </XRSpace>
    </>
  );
}

export function HandInteraction() {
  const isXRActive = useViewerStore((s) => s.isXRActive);

  if (!isXRActive) return null;

  return (
    <>
      <HandController hand="left" />
      <HandController hand="right" />
    </>
  );
}
