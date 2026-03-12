"use client";

import { useTexture } from "@react-three/drei";
import { BackSide, SRGBColorSpace } from "three";

/**
 * Renders the depth map as a sphere texture.
 * A future enhancement would apply a parallax displacement shader
 * using the depth values, but for now we display the raw depth image
 * so the user can inspect it.
 */
export function DepthView({ url }: { url: string }) {
  const texture = useTexture(url);
  texture.colorSpace = SRGBColorSpace;

  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[50, 128, 64]} />
      <meshBasicMaterial map={texture} side={BackSide} />
    </mesh>
  );
}
