"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { SplatMesh as SparkSplatMesh } from "@sparkjsdev/spark";

import { useViewerStore } from "@/lib/stores/viewer-store";

import { SparkRenderer } from "./spark/spark-renderer";

import { Loader2, Box } from "lucide-react";

type SplatQuality = "100k" | "500k" | "full";

const QUALITY_LABELS: Record<SplatQuality, string> = {
  "100k": "100K",
  "500k": "500K",
  full: "Full",
};

// ---------------------------------------------------------------------------
// Collider — invisible GLTF loaded for future physics / raycasting
// ---------------------------------------------------------------------------

function ColliderMesh({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} visible={false} />;
}

// ---------------------------------------------------------------------------
// WASD Fly Controls — pointer-lock mouse look, keyboard movement, scroll speed
// ---------------------------------------------------------------------------

function FlyControls() {
  const { camera, gl } = useThree();
  const keysRef = useRef(new Set<string>());
  const speedRef = useRef(5);
  const eulerRef = useRef(new THREE.Euler(0, 0, 0, "YXZ"));

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyF") return;
      keysRef.current.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;

    const requestLock = () => canvas.requestPointerLock();
    canvas.addEventListener("click", requestLock);

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      eulerRef.current.setFromQuaternion(camera.quaternion);
      eulerRef.current.y -= e.movementX * 0.002;
      eulerRef.current.x -= e.movementY * 0.002;
      eulerRef.current.x = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, eulerRef.current.x),
      );
      camera.quaternion.setFromEuler(eulerRef.current);
    };
    document.addEventListener("mousemove", onMouseMove);

    const onWheel = (e: WheelEvent) => {
      speedRef.current = Math.max(
        1,
        Math.min(50, speedRef.current - e.deltaY * 0.01),
      );
    };
    canvas.addEventListener("wheel", onWheel, { passive: true });

    return () => {
      canvas.removeEventListener("click", requestLock);
      document.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("wheel", onWheel);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
  }, [camera, gl]);

  const _moveDir = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const keys = keysRef.current;
    const speed = speedRef.current * delta;

    let fx = 0,
      fz = 0,
      fy = 0;
    if (keys.has("KeyW")) fz -= 1;
    if (keys.has("KeyS")) fz += 1;
    if (keys.has("KeyA")) fx -= 1;
    if (keys.has("KeyD")) fx += 1;
    if (keys.has("Space")) fy += 1;
    if (keys.has("ShiftLeft") || keys.has("ShiftRight")) fy -= 1;

    if (fx !== 0 || fz !== 0 || fy !== 0) {
      _moveDir.set(fx, 0, fz).normalize().applyQuaternion(camera.quaternion);
      camera.position.x += _moveDir.x * speed;
      camera.position.z += _moveDir.z * speed;
      camera.position.y += fy * speed;
    }
  });

  return null;
}

// ---------------------------------------------------------------------------
// Camera controller — orbit or fly depending on mode
// ---------------------------------------------------------------------------

function SplatCameraController({ flyMode }: { flyMode: boolean }) {
  if (flyMode) return <FlyControls />;

  return (
    <OrbitControls
      enableZoom
      enablePan
      rotateSpeed={-0.5}
      target={[0, 0, 0]}
    />
  );
}

// ---------------------------------------------------------------------------
// SplatScene — SparkRenderer + progressive SplatMesh loading + collider
// ---------------------------------------------------------------------------

function SplatScene({
  onQualityChange,
  onLoadingChange,
}: {
  onQualityChange: (q: SplatQuality) => void;
  onLoadingChange: (loading: boolean) => void;
}) {
  const renderer = useThree((s) => s.gl);
  const splatUrls = useViewerStore((s) => s.splatUrls);
  const colliderUrl = useViewerStore((s) => s.colliderUrl);

  const sparkRendererArgs = useMemo(() => ({ renderer }), [renderer]);

  const groupRef = useRef<THREE.Group>(null);
  const currentMeshRef = useRef<SparkSplatMesh | null>(null);

  const url100k = splatUrls.url100k;
  const url500k = splatUrls.url500k;
  const urlFull = splatUrls.urlFull;

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const chain: { url: string; quality: SplatQuality }[] = [];
    if (url100k) chain.push({ url: url100k, quality: "100k" });
    if (url500k) chain.push({ url: url500k, quality: "500k" });
    if (urlFull) chain.push({ url: urlFull, quality: "full" });
    if (chain.length === 0) return;

    let disposed = false;
    const meshes: SparkSplatMesh[] = [];
    let step = 0;

    onLoadingChange(true);

    const loadStep = () => {
      if (disposed || step >= chain.length) return;

      const { url, quality } = chain[step];
      const mesh = new SparkSplatMesh({ url });
      meshes.push(mesh);

      mesh.initialized
        .then(() => {
          if (disposed) return;

          if (currentMeshRef.current) {
            group.remove(currentMeshRef.current);
            currentMeshRef.current.dispose();
          }

          group.add(mesh);
          currentMeshRef.current = mesh;

          onQualityChange(quality);
          onLoadingChange(false);

          step++;
          loadStep();
        })
        .catch(() => {
          if (disposed) return;
          step++;
          loadStep();
        });
    };

    loadStep();

    return () => {
      disposed = true;
      for (const m of meshes) {
        group.remove(m);
        m.dispose();
      }
      currentMeshRef.current = null;
    };
  }, [url100k, url500k, urlFull, onQualityChange, onLoadingChange]);

  return (
    <>
      <SparkRenderer args={[sparkRendererArgs]} />
      <group ref={groupRef} />
      {colliderUrl && (
        <Suspense fallback={null}>
          <ColliderMesh url={colliderUrl} />
        </Suspense>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// SplatWorld — exported top-level viewer (owns its Canvas)
// ---------------------------------------------------------------------------

export function SplatWorld() {
  const splatUrls = useViewerStore((s) => s.splatUrls);
  const hasAnySplat = splatUrls.url100k || splatUrls.url500k || splatUrls.urlFull;

  const [quality, setQuality] = useState<SplatQuality>("100k");
  const [isLoading, setIsLoading] = useState(true);
  const [flyMode, setFlyMode] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyF" && !e.repeat) setFlyMode((prev) => !prev);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!hasAnySplat) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
        <div className="flex flex-col items-center gap-2">
          <Box size={28} className="opacity-50" />
          <span>Generate a 3D world to view it here</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [0, 1.6, 3], fov: 60 }}
        frameloop="always"
        gl={{ antialias: false }}
      >
        <Suspense fallback={null}>
          <SplatScene
            onQualityChange={setQuality}
            onLoadingChange={setIsLoading}
          />
          <SplatCameraController flyMode={flyMode} />
        </Suspense>
      </Canvas>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-primary)]">
          <Loader2
            className="animate-spin text-[var(--accent-primary)]"
            size={24}
          />
        </div>
      )}

      {!isLoading && (
        <div className="absolute top-3 right-3 z-10 rounded-full bg-[var(--bg-secondary)]/80 px-2.5 py-1 text-[10px] text-[var(--text-muted)] border border-[var(--border-default)] backdrop-blur-sm">
          {QUALITY_LABELS[quality]}
        </div>
      )}

      {!isLoading && (
        <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-[var(--bg-secondary)]/80 px-3 py-1.5 text-[10px] text-[var(--text-muted)] border border-[var(--border-default)] backdrop-blur-sm">
          {flyMode
            ? "WASD move · Space/Shift up/down · Scroll speed · F exit"
            : "Drag to orbit · Scroll to zoom · F for fly mode"}
        </div>
      )}
    </div>
  );
}
