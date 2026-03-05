"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useThree, useFrame, type ThreeEvent } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

interface PositionedImage {
  id: string;
  url: string;
  longitude: number;
  latitude: number;
  angularSize: number;
}

interface InputCanvasViewProps {
  images: PositionedImage[];
  onUpdatePosition?: (id: string, longitude: number, latitude: number) => void;
  onUpdateScale?: (id: string, angularSize: number) => void;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onDragStateChange?: (dragging: boolean) => void;
}

const SPHERE_RADIUS = 49;

export function sphericalToCartesian(lng: number, lat: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

export function cartesianToSpherical(point: THREE.Vector3): { longitude: number; latitude: number } {
  const r = point.length();
  const lat = 90 - Math.acos(point.y / r) * (180 / Math.PI);
  const lng = Math.atan2(point.z, -point.x) * (180 / Math.PI) - 180;
  return { longitude: ((lng + 540) % 360) - 180, latitude: Math.max(-85, Math.min(85, lat)) };
}

const DRAG_THRESHOLD = 6;

function ImagePatch({
  image,
  isSelected,
  onSelect,
  onDragEnd,
  onScaleChange,
  onDragStateChange,
}: {
  image: PositionedImage;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (lng: number, lat: number) => void;
  onScaleChange?: (angularSize: number) => void;
  onDragStateChange?: (dragging: boolean) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const draggingRef = useRef(false);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);
  const { camera, gl } = useThree();
  const sphereGeo = useRef(new THREE.Sphere(new THREE.Vector3(), SPHERE_RADIUS));
  const raycasterRef = useRef(new THREE.Raycaster());

  const texture = useTexture(image.url);

  const position = useMemo(
    () => sphericalToCartesian(image.longitude, image.latitude, SPHERE_RADIUS),
    [image.longitude, image.latitude],
  );

  const lookTarget = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const scale = useMemo(() => {
    const halfAngleRad = (image.angularSize / 2) * (Math.PI / 180);
    const w = 2 * SPHERE_RADIUS * Math.sin(halfAngleRad);
    const img = texture.image as { width?: number; height?: number } | undefined;
    const aspect = img?.width && img?.height ? img.width / img.height : 1;
    const h = w / aspect;
    return new THREE.Vector3(w, h, 1);
  }, [image.angularSize, texture]);

  useFrame(() => {
    if (!meshRef.current) return;
    meshRef.current.lookAt(lookTarget);
  });

  const raycastToSphere = useCallback(
    (clientX: number, clientY: number): THREE.Vector3 | null => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycasterRef.current.setFromCamera(ndc, camera);
      const target = new THREE.Vector3();
      return raycasterRef.current.ray.intersectSphere(sphereGeo.current, target);
    },
    [camera, gl],
  );

  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!isSelected) {
        e.stopPropagation();
        onSelect();
        return;
      }
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      pendingRef.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
      gl.domElement.style.cursor = "grabbing";
    },
    [isSelected, onSelect, gl],
  );

  useEffect(() => {
    if (!isSelected) return;
    const el = gl.domElement;

    const onPointerMove = (e: PointerEvent) => {
      if (pendingRef.current && !draggingRef.current) {
        const dx = e.clientX - pendingRef.current.x;
        const dy = e.clientY - pendingRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
        draggingRef.current = true;
        onDragStateChange?.(true);
      }

      if (!draggingRef.current || !meshRef.current) return;
      const hit = raycastToSphere(e.clientX, e.clientY);
      if (hit) {
        meshRef.current.position.copy(hit);
      }
    };

    const onPointerUp = () => {
      pendingRef.current = null;
      if (!draggingRef.current) {
        el.style.cursor = "";
        return;
      }
      draggingRef.current = false;
      onDragStateChange?.(false);
      el.style.cursor = "";
      if (meshRef.current) {
        const { longitude, latitude } = cartesianToSpherical(meshRef.current.position);
        onDragEnd(longitude, latitude);
      }
    };

    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    return () => {
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
    };
  }, [isSelected, gl, raycastToSphere, onDragEnd, onDragStateChange]);

  useEffect(() => {
    if (!isSelected || !onScaleChange) return;
    const el = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -5 : 5;
      const newSize = Math.max(10, Math.min(360, image.angularSize + delta));
      onScaleChange(newSize);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [isSelected, gl, image.angularSize, onScaleChange]);

  return (
    <mesh
      ref={meshRef}
      position={position}
      scale={scale}
      renderOrder={1}
      onPointerDown={handlePointerDown}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        side={THREE.DoubleSide}
        transparent
        opacity={isSelected ? 1 : 0.85}
        depthTest={false}
      />
      {isSelected && (
        <lineSegments renderOrder={2}>
          <edgesGeometry args={[new THREE.PlaneGeometry(1, 1)]} />
          <lineBasicMaterial color="#ffffff" linewidth={2} depthTest={false} />
        </lineSegments>
      )}
    </mesh>
  );
}

export function InputCanvasView({
  images,
  onUpdatePosition,
  onUpdateScale,
  selectedId,
  onSelect,
  onDragStateChange,
}: InputCanvasViewProps) {
  const handleBackgroundClick = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onSelect?.(null);
    },
    [onSelect],
  );

  return (
    <group>
      <mesh renderOrder={0} onPointerDown={handleBackgroundClick}>
        <sphereGeometry args={[50, 64, 32]} />
        <meshBasicMaterial color="#1a1a26" side={THREE.BackSide} />
      </mesh>

      {images.map((img) => (
        <ImagePatch
          key={img.id}
          image={img}
          isSelected={selectedId === img.id}
          onSelect={() => onSelect?.(img.id)}
          onDragEnd={(lng, lat) => onUpdatePosition?.(img.id, lng, lat)}
          onScaleChange={(size) => onUpdateScale?.(img.id, size)}
          onDragStateChange={onDragStateChange}
        />
      ))}
    </group>
  );
}

export type { PositionedImage };
