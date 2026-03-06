"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Image,
  Video,
  Box,
  Layers,
  Download,
  Trash2,
  Grid,
  CheckSquare,
  Square,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAssets, useDeleteAsset, useDeleteAssets } from "@/hooks/use-assets";
import { useViewerStore } from "@/lib/stores/viewer-store";
import { cn } from "@/lib/utils/cn";
import type { AssetRow } from "@/lib/supabase/types";

const ASSET_ICONS: Record<string, typeof Image> = {
  equirect_image: Image,
  video: Video,
  upscaled_video: Video,
  depth_map: Layers,
  splat_100k: Box,
  splat_500k: Box,
  splat_full: Box,
};

const ASSET_LABELS: Record<string, string> = {
  equirect_image: "360° Image",
  video: "Video",
  upscaled_video: "Upscaled Video",
  depth_map: "Depth Map",
  splat_100k: "Splat 100K",
  splat_500k: "Splat 500K",
  splat_full: "Splat Full",
  collider_mesh: "Collider",
  panorama: "Panorama",
  thumbnail: "Thumbnail",
};

const MODE_FOR_TYPE: Record<string, string> = {
  equirect_image: "equirect",
  video: "video",
  upscaled_video: "video",
  depth_map: "depth",
  splat_100k: "splat",
  splat_500k: "splat",
  splat_full: "splat",
};

interface AssetPanelProps {
  sceneId: string;
  floating?: boolean;
  onOpenGallery?: () => void;
}

export function AssetPanel({ sceneId, floating, onOpenGallery }: AssetPanelProps) {
  const { data: assets } = useAssets(sceneId);
  const { mode, setMode, setEquirectUrl, setVideoUrl, setDepthUrl } =
    useViewerStore();
  const deleteAsset = useDeleteAsset(sceneId);
  const deleteAssets = useDeleteAssets(sceneId);

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelect = (asset: AssetRow) => {
    if (bulkMode) {
      toggleSelect(asset.id);
      return;
    }
    const url = asset.public_url ?? "";
    switch (asset.type) {
      case "equirect_image":
        setEquirectUrl(url);
        setMode("equirect");
        break;
      case "video":
      case "upscaled_video":
        setVideoUrl(url);
        setMode("video");
        break;
      case "depth_map":
        setDepthUrl(url);
        setMode("depth");
        break;
      case "splat_100k":
      case "splat_500k":
      case "splat_full":
        setMode("splat");
        break;
    }
  };

  const handleDeleteSingle = useCallback(
    (e: React.MouseEvent, assetId: string) => {
      e.stopPropagation();
      if (!confirm("Delete this asset?")) return;
      deleteAsset.mutate(assetId, {
        onSuccess: () => toast.success("Asset deleted"),
        onError: (err) => toast.error(err.message),
      });
    },
    [deleteAsset],
  );

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} asset(s)?`)) return;
    deleteAssets.mutate(Array.from(selectedIds), {
      onSuccess: () => {
        toast.success(`${selectedIds.size} asset(s) deleted`);
        setSelectedIds(new Set());
        setBulkMode(false);
      },
      onError: (err) => toast.error(err.message),
    });
  }, [selectedIds, deleteAssets]);

  if (!assets?.length) return null;

  if (floating) {
    return (
      <div className="flex items-center gap-0.5 bg-[var(--bg-elevated)]/80 backdrop-blur-sm rounded-full border border-[var(--border-default)] p-1">
        {assets.map((asset) => {
          const Icon = ASSET_ICONS[asset.type] ?? Box;
          const isActive = mode === MODE_FOR_TYPE[asset.type];
          return (
            <button
              key={asset.id}
              onClick={() => handleSelect(asset)}
              title={ASSET_LABELS[asset.type] ?? asset.type}
              className={cn(
                "relative group flex items-center justify-center w-7 h-7 rounded-full transition-colors",
                isActive
                  ? "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]",
              )}
            >
              <Icon size={14} />
              <span className="absolute bottom-full mb-1.5 whitespace-nowrap rounded-md bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--text-primary)] opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity border border-[var(--border-default)]">
                {ASSET_LABELS[asset.type] ?? asset.type}
              </span>
            </button>
          );
        })}
        {onOpenGallery && (
          <button
            onClick={onOpenGallery}
            title="Open Gallery"
            className="flex items-center justify-center w-7 h-7 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
          >
            <Grid size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-3">
      {/* Header with actions */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
          Assets
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setBulkMode(!bulkMode);
              if (bulkMode) setSelectedIds(new Set());
            }}
            className={cn(
              "p-1 rounded transition-colors",
              bulkMode
                ? "text-[var(--accent-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
            )}
            title="Bulk select"
          >
            <CheckSquare size={12} />
          </button>
          {onOpenGallery && (
            <button
              onClick={onOpenGallery}
              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              title="Open gallery"
            >
              <Grid size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {bulkMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className="text-[10px] text-[var(--text-muted)]">
                {selectedIds.size} selected
              </span>
              <button
                onClick={handleBulkDelete}
                disabled={deleteAssets.isPending}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
              >
                {deleteAssets.isPending ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <Trash2 size={10} />
                )}
                Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Asset list */}
      {assets.map((asset) => {
        const Icon = ASSET_ICONS[asset.type] ?? Box;
        const isActive = !bulkMode && mode === MODE_FOR_TYPE[asset.type];
        const isSelected = bulkMode && selectedIds.has(asset.id);

        return (
          <button
            key={asset.id}
            onClick={() => handleSelect(asset)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
              isActive
                ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                : isSelected
                  ? "bg-[var(--accent-primary)]/5 text-[var(--accent-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]",
            )}
          >
            {bulkMode && (
              <span className="shrink-0">
                {isSelected ? (
                  <CheckSquare size={12} className="text-[var(--accent-primary)]" />
                ) : (
                  <Square size={12} className="text-[var(--text-muted)]" />
                )}
              </span>
            )}
            <Icon size={14} />
            <span className="flex-1 text-left truncate">
              {ASSET_LABELS[asset.type] ?? asset.type}
            </span>
            {!bulkMode && (
              <span className="flex items-center gap-1 shrink-0">
                {asset.public_url && (
                  <a
                    href={asset.public_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[var(--text-muted)] hover:text-[var(--accent-primary)] p-0.5"
                  >
                    <Download size={12} />
                  </a>
                )}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => handleDeleteSingle(e, asset.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleDeleteSingle(
                        e as unknown as React.MouseEvent,
                        asset.id,
                      );
                    }
                  }}
                  className="text-[var(--text-muted)] hover:text-red-400 p-0.5 cursor-pointer"
                >
                  <Trash2 size={12} />
                </span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
