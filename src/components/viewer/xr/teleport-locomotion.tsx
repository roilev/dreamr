"use client";

import { TeleportTarget } from "@react-three/xr";

interface TeleportLocomotionProps {
  enabled?: boolean;
}

export function TeleportLocomotion({ enabled = true }: TeleportLocomotionProps) {
  if (!enabled) return null;

  return (
    <TeleportTarget>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </TeleportTarget>
  );
}
