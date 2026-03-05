"use client";

import { useViewerStore } from "@/lib/stores/viewer-store";
import { Text } from "@react-three/drei";

export function ContextualController() {
  const mode = useViewerStore((s) => s.mode);
  const isXRActive = useViewerStore((s) => s.isXRActive);

  if (!isXRActive) return null;

  return (
    <group position={[0, 1.2, -1.5]}>
      <mesh>
        <planeGeometry args={[0.6, 0.3]} />
        <meshBasicMaterial color="#1a1a2e" opacity={0.85} transparent />
      </mesh>
      <Text
        position={[0, 0.05, 0.01]}
        fontSize={0.04}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {mode.toUpperCase()}
      </Text>
      <Text
        position={[0, -0.05, 0.01]}
        fontSize={0.025}
        color="#888888"
        anchorX="center"
        anchorY="middle"
      >
        Point and squeeze to interact
      </Text>
    </group>
  );
}
