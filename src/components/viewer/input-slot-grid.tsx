"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImagePlus, X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_SENSITIVITY = 0.002;

function useZoomPan() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = 1 - e.deltaY * ZOOM_SENSITIVITY;
      setScale((prev) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * factor)));
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        isPanning.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        el.style.cursor = "grabbing";
        e.preventDefault();
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isPanning.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      setTranslate((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    };

    const onMouseUp = () => {
      if (isPanning.current) {
        isPanning.current = false;
        el.style.cursor = "";
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchDist.current = Math.hypot(dx, dy);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && lastPinchDist.current !== null) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const factor = dist / lastPinchDist.current;
        lastPinchDist.current = dist;
        setScale((prev) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * factor)));
      }
    };

    const onTouchEnd = () => {
      lastPinchDist.current = null;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  return { containerRef, scale, translate, resetZoom };
}

export type SlotPosition = "front" | "left" | "right" | "back" | "top" | "bottom";

export interface SlotImage {
  id: string;
  url: string;
  slot: SlotPosition;
}

interface InputSlotGridProps {
  images: SlotImage[];
  onMoveImage?: (imageId: string, toSlot: SlotPosition) => void;
  onRemoveImage?: (imageId: string) => void;
  onDropFiles?: (files: File[], slot: SlotPosition) => void;
  className?: string;
}

const SLOT_CONFIG: {
  id: SlotPosition;
  label: string;
  row: number;
  col: number;
  rotateY: number;
}[] = [
  { id: "left", label: "Left", row: 1, col: 0, rotateY: 35 },
  { id: "front", label: "Front", row: 1, col: 1, rotateY: 0 },
  { id: "right", label: "Right", row: 1, col: 2, rotateY: -35 },
  { id: "back", label: "Back", row: 1, col: 3, rotateY: 0 },
  { id: "top", label: "Top", row: 0, col: 1, rotateY: 0 },
  { id: "bottom", label: "Bottom", row: 2, col: 1, rotateY: 0 },
];

function SlotCell({
  slot,
  image,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onRemove,
  onFileDrop,
}: {
  slot: (typeof SLOT_CONFIG)[number];
  image?: SlotImage;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onRemove?: () => void;
  onFileDrop: (files: File[]) => void;
}) {
  const isHorizontalSlot = slot.row === 1;

  return (
    <div className="group relative p-1">
      <motion.div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          perspective: isHorizontalSlot ? "400px" : undefined,
        }}
        className={cn(
          "relative rounded-xl border-2 border-dashed transition-all duration-200",
          "flex items-center justify-center",
          isDragOver
            ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 scale-105"
            : image
              ? "border-white/15 bg-white/5"
              : "border-white/10 bg-white/[0.02] hover:border-white/20",
          "aspect-square",
        )}
      >
        <motion.div
          className="w-full h-full flex items-center justify-center overflow-hidden rounded-[10px]"
          style={{
            transform: isHorizontalSlot ? `rotateY(${slot.rotateY}deg)` : undefined,
            transformStyle: "preserve-3d",
          }}
        >
          {image ? (
            <div className="group relative w-full h-full">
              <img
                src={image.url}
                alt={slot.label}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", image.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                className="w-full h-full object-contain rounded-[10px] cursor-grab active:cursor-grabbing bg-black/20"
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded-[10px]">
                <GripVertical size={16} className="text-white/70" />
              </div>
            </div>
          ) : (
            <div
              className="flex flex-col items-center gap-1 cursor-pointer p-2"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = (e) => {
                  const files = Array.from((e.target as HTMLInputElement).files || []);
                  if (files.length > 0) onFileDrop(files);
                };
                input.click();
              }}
            >
              <ImagePlus size={16} className="text-white/30" />
              <span className="text-[9px] text-white/30 font-medium uppercase tracking-wider">
                {slot.label}
              </span>
            </div>
          )}
        </motion.div>
      </motion.div>

      {image && onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-0 right-0 z-20 h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ transform: "translate(25%, -25%)" }}
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}

function SingleImageView({
  image,
  onRemove,
}: {
  image: SlotImage;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center justify-center h-full w-full p-8">
      <div className="group relative inline-block">
        <img
          src={image.url}
          alt="Reference"
          className="max-w-full max-h-[60vh] w-auto h-auto rounded-2xl border border-white/15"
        />
        {onRemove && (
          <button
            onClick={onRemove}
            className="absolute -top-2 -right-2 z-20 h-6 w-6 flex items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

export function InputSlotGrid({
  images,
  onMoveImage,
  onRemoveImage,
  onDropFiles,
  className,
}: InputSlotGridProps) {
  const [dragOverSlot, setDragOverSlot] = useState<SlotPosition | null>(null);
  const { containerRef, scale, translate, resetZoom } = useZoomPan();

  const imageBySlot = new Map<SlotPosition, SlotImage>();
  for (const img of images) {
    imageBySlot.set(img.slot, img);
  }

  const handleDragOver = useCallback((e: React.DragEvent, slot: SlotPosition) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSlot(slot);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, slot: SlotPosition) => {
    e.preventDefault();
    setDragOverSlot(null);

    const imageId = e.dataTransfer.getData("text/plain");
    if (imageId && onMoveImage) {
      onMoveImage(imageId, slot);
      return;
    }

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length > 0 && onDropFiles) {
      onDropFiles(files, slot);
    }
  }, [onMoveImage, onDropFiles]);

  const showZoomIndicator = Math.abs(scale - 1) > 0.05;

  return (
    <div
      ref={containerRef}
      className={cn("relative h-full w-full overflow-hidden", className)}
    >
      <div
        className="flex items-center justify-center h-full w-full p-8"
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: "center center",
          transition: "none",
        }}
      >
        {images.length === 1 ? (
          <SingleImageView
            image={images[0]}
            onRemove={onRemoveImage ? () => onRemoveImage(images[0].id) : undefined}
          />
        ) : (
          <div className="w-full max-w-lg">
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: "repeat(4, 1fr)",
                gridTemplateRows: "repeat(3, 1fr)",
              }}
            >
              {SLOT_CONFIG.map((slot) => (
                <div
                  key={slot.id}
                  style={{
                    gridRow: slot.row + 1,
                    gridColumn: slot.col + 1,
                  }}
                >
                  <SlotCell
                    slot={slot}
                    image={imageBySlot.get(slot.id)}
                    isDragOver={dragOverSlot === slot.id}
                    onDragOver={(e) => handleDragOver(e, slot.id)}
                    onDragLeave={() => setDragOverSlot(null)}
                    onDrop={(e) => handleDrop(e, slot.id)}
                    onRemove={
                      imageBySlot.has(slot.id)
                        ? () => onRemoveImage?.(imageBySlot.get(slot.id)!.id)
                        : undefined
                    }
                    onFileDrop={(files) => onDropFiles?.(files, slot.id)}
                  />
                </div>
              ))}
            </div>

            <AnimatePresence>
              {images.length === 0 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-xs text-white/30 mt-4"
                >
                  Drop images into slots to position them in the 360° scene
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {showZoomIndicator && (
        <button
          onClick={resetZoom}
          className="absolute bottom-20 right-4 z-10 rounded-full bg-[var(--bg-secondary)]/80 backdrop-blur-sm px-3 py-1.5 text-[10px] text-[var(--text-secondary)] border border-[var(--border-default)] hover:text-[var(--text-primary)] transition-colors"
        >
          {Math.round(scale * 100)}% · Reset
        </button>
      )}
    </div>
  );
}
