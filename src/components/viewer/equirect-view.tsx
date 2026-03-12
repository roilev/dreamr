"use client";

import { useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { BackSide, SRGBColorSpace, ShaderMaterial, Vector3 } from "three";
import { useRef } from "react";

const DEPTH_VERTEX = `
  uniform sampler2D tDepth;
  uniform float uDisplacement;
  uniform vec3 uCameraDir;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position;

    if (uDisplacement > 0.0) {
      float d = texture2D(tDepth, uv).r;
      // Displace inward (toward center) for far objects, outward for near
      float offset = (1.0 - d) * uDisplacement;
      pos = pos * (1.0 - offset * 0.15);
    }

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const DEPTH_FRAGMENT = `
  uniform sampler2D tColor;
  varying vec2 vUv;

  void main() {
    gl_FragColor = texture2D(tColor, vUv);
  }
`;

interface EquirectViewProps {
  url: string;
  depthUrl?: string | null;
  depthEnabled?: boolean;
}

export function EquirectView({ url, depthUrl, depthEnabled = false }: EquirectViewProps) {
  const colorTexture = useTexture(url);
  colorTexture.colorSpace = SRGBColorSpace;

  const depthTexture = useTexture(depthUrl || url);
  const materialRef = useRef<ShaderMaterial>(null);
  const cameraDirRef = useRef(new Vector3());

  const uniforms = useMemo(
    () => ({
      tColor: { value: colorTexture },
      tDepth: { value: depthTexture },
      uDisplacement: { value: depthEnabled && depthUrl ? 1.0 : 0.0 },
      uCameraDir: { value: new Vector3(0, 0, -1) },
    }),
    // Intentionally only create once
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame(({ camera }) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.tColor.value = colorTexture;
    materialRef.current.uniforms.tDepth.value = depthTexture;
    materialRef.current.uniforms.uDisplacement.value = depthEnabled && depthUrl ? 1.0 : 0.0;
    camera.getWorldDirection(cameraDirRef.current);
    materialRef.current.uniforms.uCameraDir.value.copy(cameraDirRef.current);
  });

  if (!depthEnabled || !depthUrl) {
    return (
      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[50, 128, 64]} />
        <meshBasicMaterial map={colorTexture} side={BackSide} />
      </mesh>
    );
  }

  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[50, 256, 128]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={DEPTH_VERTEX}
        fragmentShader={DEPTH_FRAGMENT}
        uniforms={uniforms}
        side={BackSide}
      />
    </mesh>
  );
}
