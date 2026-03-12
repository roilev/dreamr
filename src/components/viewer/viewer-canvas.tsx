"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useViewerStore } from "@/lib/stores/viewer-store";
import { useSceneStore } from "@/lib/stores/scene-store";
import { EquirectView } from "./equirect-view";
import { VideoSphere } from "./video-sphere";
import { InputCanvasView } from "./input-canvas-view";
import { Loader2, ImagePlus, Minus, Plus } from "lucide-react";
import { SplatWorld } from "./splat-world";
import { PlatformControls } from "./controls";
import { GenerationLoading } from "./generation-loading";
import { InputSlotGrid, type SlotImage, type SlotPosition } from "./input-slot-grid";
import { NoToneMapping } from "three";
import type { ViewerMode, ViewerInputImage } from "@/lib/types/stores";

function CameraAligner() {
  const { camera } = useThree();
  const { initialLookLongitude, setInitialLookLongitude } = useViewerStore();
  const appliedRef = useRef(false);

  useEffect(() => {
    if (initialLookLongitude === null || appliedRef.current) return;
    appliedRef.current = true;

    const lngRad = (initialLookLongitude * Math.PI) / 180;
    camera.rotation.set(0, -Math.PI / 2 + lngRad, 0);
    camera.updateProjectionMatrix();

    setInitialLookLongitude(null);
  }, [initialLookLongitude, camera, setInitialLookLongitude]);

  return null;
}

function ViewerContent() {
  const { mode, equirectUrl, videoUrl, depthUrl } = useViewerStore();

  if ((mode === "equirect" || mode === "depth") && equirectUrl) {
    return (
      <EquirectView
        url={equirectUrl}
        depthUrl={depthUrl}
        depthEnabled={mode === "depth" && !!depthUrl}
      />
    );
  }

  if (mode === "video" && videoUrl) {
    return <VideoSphere key={videoUrl} url={videoUrl} />;
  }

  return null;
}

function PlaceNewImagesInFront() {
  const { inputImages, setInputImages } = useViewerStore();
  const placedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unplaced = inputImages.filter(
      (img) => img.needsPlacement && !placedIdsRef.current.has(img.id),
    );
    if (unplaced.length === 0) return;

    const updated = inputImages.map((img) => {
      if (!img.needsPlacement || placedIdsRef.current.has(img.id)) return img;
      placedIdsRef.current.add(img.id);
      const idx = unplaced.indexOf(img);
      const offset = (idx - (unplaced.length - 1) / 2) * 30;
      return {
        ...img,
        longitude: offset,
        latitude: 0,
        needsPlacement: false,
      };
    });
    setInputImages(updated);

    const sceneId = useSceneStore.getState().scene?.id;
    if (sceneId) {
      const batch = unplaced.map((img) => {
        const idx = unplaced.indexOf(img);
        const offset = (idx - (unplaced.length - 1) / 2) * 30;
        return {
          id: img.id,
          position_x: offset,
          position_y: 0,
          position_z: img.angularSize,
        };
      });
      fetch(`/api/scenes/${sceneId}/inputs`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      }).catch(() => {});
    }
  }, [inputImages, setInputImages]);

  return null;
}

function InputCanvasContent({
  selectedId,
  setSelectedId,
  onDragStateChange,
}: {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  onDragStateChange: (dragging: boolean) => void;
}) {
  const { inputImages, setInputImages } = useViewerStore();
  const pendingPersistRef = useRef<Map<string, { position_x: number; position_y: number; position_z: number }>>(new Map());
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPersist = useCallback(() => {
    const sceneId = useSceneStore.getState().scene?.id;
    if (!sceneId || pendingPersistRef.current.size === 0) return;

    const batch = Array.from(pendingPersistRef.current.entries()).map(([id, pos]) => ({
      id,
      ...pos,
    }));
    pendingPersistRef.current.clear();

    fetch(`/api/scenes/${sceneId}/inputs`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    }).catch(() => {});
  }, []);

  const schedulePersist = useCallback(
    (id: string, lng: number, lat: number, angularSize: number) => {
      pendingPersistRef.current.set(id, {
        position_x: lng,
        position_y: lat,
        position_z: angularSize,
      });
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(flushPersist, 800);
    },
    [flushPersist],
  );

  const handleUpdatePosition = useCallback(
    (id: string, longitude: number, latitude: number) => {
      const updated = inputImages.map((img) =>
        img.id === id ? { ...img, longitude, latitude, needsPlacement: false } : img,
      );
      setInputImages(updated);
      const img = updated.find((i) => i.id === id);
      if (img) schedulePersist(id, longitude, latitude, img.angularSize);
    },
    [inputImages, setInputImages, schedulePersist],
  );

  const handleUpdateScale = useCallback(
    (id: string, angularSize: number) => {
      const updated = inputImages.map((img) =>
        img.id === id ? { ...img, angularSize } : img,
      );
      setInputImages(updated);
      const img = updated.find((i) => i.id === id);
      if (img) schedulePersist(id, img.longitude, img.latitude, angularSize);
    },
    [inputImages, setInputImages, schedulePersist],
  );

  return (
    <>
      <PlaceNewImagesInFront />
      <InputCanvasView
        images={inputImages}
        onUpdatePosition={handleUpdatePosition}
        onUpdateScale={handleUpdateScale}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onDragStateChange={onDragStateChange}
      />
    </>
  );
}

function ScaleSlider({
  selectedId,
  images,
  onScaleChange,
}: {
  selectedId: string | null;
  images: ViewerInputImage[];
  onScaleChange: (id: string, size: number) => void;
}) {
  const selected = selectedId ? images.find((i) => i.id === selectedId) : null;
  if (!selected) return null;

  const size = selected.angularSize;
  const adjust = (delta: number) =>
    onScaleChange(selected.id, Math.max(10, Math.min(360, size + delta)));

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-full bg-[var(--bg-secondary)]/90 backdrop-blur-sm px-4 py-2 border border-[var(--border-default)] shadow-lg">
      <button
        onClick={() => adjust(-10)}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
      >
        <Minus size={12} />
      </button>
      <div className="flex flex-col items-center gap-0.5">
        <input
          type="range"
          min={10}
          max={360}
          step={1}
          value={size}
          onChange={(e) => onScaleChange(selected.id, Number(e.target.value))}
          className="w-28 accent-[var(--accent-primary)] h-1.5 cursor-pointer"
        />
        <span className="text-[10px] text-[var(--text-muted)]">
          Scale: {size}°
        </span>
      </div>
      <button
        onClick={() => adjust(10)}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
      >
        <Plus size={12} />
      </button>
    </div>
  );
}

function DragAwareOrbitControls({ isDragging }: { isDragging: boolean }) {
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = !isDragging;
    }
  }, [isDragging]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableZoom={false}
      enablePan={false}
      rotateSpeed={-0.3}
      touches={{ ONE: 1, TWO: 2 }}
      target={[0, 0, 0]}
    />
  );
}

function InputCanvasWithControls({ inputImages }: { inputImages: ViewerInputImage[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { setInputImages } = useViewerStore();
  const sliderPersistRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScaleChange = useCallback(
    (id: string, size: number) => {
      const updated = inputImages.map((img) =>
        img.id === id ? { ...img, angularSize: size } : img,
      );
      setInputImages(updated);

      if (sliderPersistRef.current) clearTimeout(sliderPersistRef.current);
      sliderPersistRef.current = setTimeout(() => {
        const sceneId = useSceneStore.getState().scene?.id;
        if (!sceneId) return;
        const img = updated.find((i) => i.id === id);
        if (!img) return;
        fetch(`/api/scenes/${sceneId}/inputs`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([{ id, position_x: img.longitude, position_y: img.latitude, position_z: size }]),
        }).catch(() => {});
      }, 800);
    },
    [inputImages, setInputImages],
  );

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [-0.1, 0, 0], fov: 75 }}
        frameloop="always"
      >
        <Suspense fallback={null}>
          <InputCanvasContent
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            onDragStateChange={setIsDragging}
          />
          <DragAwareOrbitControls isDragging={isDragging} />
        </Suspense>
      </Canvas>
      <ScaleSlider
        selectedId={selectedId}
        images={inputImages}
        onScaleChange={handleScaleChange}
      />
      {selectedId && (
        <div className="absolute top-3 right-3 z-20 rounded-full bg-[var(--bg-secondary)]/80 backdrop-blur-sm px-3 py-1.5 text-[10px] text-[var(--text-muted)] border border-[var(--border-default)]">
          Drag to move · Scroll to scale · Click elsewhere to deselect
        </div>
      )}
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-primary)]">
      <Loader2 className="animate-spin text-[var(--accent-primary)]" size={24} />
    </div>
  );
}


function positionToSlot(lng: number, lat: number): SlotPosition {
  if (lat > 45) return "top";
  if (lat < -45) return "bottom";
  const norm = ((lng % 360) + 360) % 360;
  if (norm < 45 || norm >= 315) return "front";
  if (norm >= 45 && norm < 135) return "right";
  if (norm >= 135 && norm < 225) return "back";
  return "left";
}

function slotToPosition(slot: SlotPosition): { lng: number; lat: number } {
  switch (slot) {
    case "front": return { lng: 0, lat: 0 };
    case "right": return { lng: 90, lat: 0 };
    case "back": return { lng: 180, lat: 0 };
    case "left": return { lng: -90, lat: 0 };
    case "top": return { lng: 0, lat: 70 };
    case "bottom": return { lng: 0, lat: -70 };
  }
}

export function ViewerCanvas({ mode }: { mode: ViewerMode }) {
  const { inputImages } = useViewerStore();

  if (mode === "empty") {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
        <div className="flex flex-col items-center gap-2">
          <ImagePlus size={28} className="text-[var(--text-muted)] opacity-50" />
          <span>Enter a prompt or drop an image to start</span>
        </div>
      </div>
    );
  }

  if (mode === "loading") {
    return <GenerationLoading />;
  }

  if (mode === "splat") {
    return <SplatWorld />;
  }

  if (mode === "input_canvas") {
    const slotImages: SlotImage[] = inputImages.map((img) => ({
      id: img.id,
      url: img.url,
      slot: (positionToSlot(img.longitude, img.latitude)) as SlotPosition,
    }));

    return (
      <InputSlotGrid
        images={slotImages}
        onRemoveImage={(id) => {
          const updated = inputImages.filter((img) => img.id !== id);
          useViewerStore.getState().setInputImages(updated);
        }}
        onMoveImage={(id, toSlot) => {
          const { lng, lat } = slotToPosition(toSlot);
          const updated = inputImages.map((img) =>
            img.id === id ? { ...img, longitude: lng, latitude: lat } : img,
          );
          useViewerStore.getState().setInputImages(updated);
        }}
      />
    );
  }

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [0, 0, 0.1], fov: 75 }}
        frameloop={mode === "video" ? "always" : "demand"}
        gl={{ toneMapping: NoToneMapping }}
      >
        <Suspense fallback={null}>
          <CameraAligner />
          <ViewerContent />
          <PlatformControls mode={mode} />
        </Suspense>
      </Canvas>
    </div>
  );
}
