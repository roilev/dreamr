"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImagePlus, X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils/cn";

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
    <motion.div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        perspective: isHorizontalSlot ? "400px" : undefined,
      }}
      className={cn(
        "relative rounded-xl border-2 border-dashed transition-all duration-200",
        "flex items-center justify-center overflow-hidden",
        isDragOver
          ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 scale-105"
          : image
            ? "border-white/15 bg-white/5"
            : "border-white/10 bg-white/[0.02] hover:border-white/20",
        isHorizontalSlot ? "aspect-[4/3]" : "aspect-square",
      )}
    >
      <motion.div
        className="w-full h-full flex items-center justify-center"
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
              className="w-full h-full object-cover rounded-lg cursor-grab active:cursor-grabbing"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded-lg">
              <GripVertical size={16} className="text-white/70" />
            </div>
            {onRemove && (
              <button
                onClick={onRemove}
                className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-md hidden group-hover:flex z-10"
              >
                <X size={10} />
              </button>
            )}
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

  return (
    <div className={cn("flex items-center justify-center h-full w-full p-8", className)}>
      <div className="w-full max-w-lg">
        {/* Curved panoramic grid */}
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: "1fr 1.5fr 1fr 1fr",
            gridTemplateRows: "auto auto auto",
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

        {/* Hint text */}
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
    </div>
  );
}
