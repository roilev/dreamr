"use client";

import { useTexture } from "@react-three/drei";
import { BackSide, SRGBColorSpace } from "three";

export function EquirectView({ url }: { url: string }) {
  const texture = useTexture(url);
  texture.colorSpace = SRGBColorSpace;

  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[50, 128, 64]} />
      <meshBasicMaterial map={texture} side={BackSide} />
    </mesh>
  );
}
