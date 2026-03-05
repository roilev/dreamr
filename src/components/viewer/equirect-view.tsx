"use client";

import { useTexture } from "@react-three/drei";
import { BackSide } from "three";

export function EquirectView({ url }: { url: string }) {
  const texture = useTexture(url);

  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[50, 64, 32]} />
      <meshBasicMaterial map={texture} side={BackSide} />
    </mesh>
  );
}
