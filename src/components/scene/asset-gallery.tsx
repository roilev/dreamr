"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Grid,
  List,
  Trash2,
  Download,
  Eye,
  CheckSquare,
  Square,
  Image,
  Video,
  Layers,
  Box,
  X,
  Filter,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { toast } from "sonner";
import { useAssets, useDeleteAsset, useDeleteAssets } from "@/hooks/use-assets";
import { useViewerStore } from "@/lib/stores/viewer-store";
import type { AssetRow, AssetType } from "@/lib/supabase/types";

const ASSET_TYPE_CONFIG: Record<
  string,
  { label: string; icon: typeof Image }
> = {
  equirect_image: { label: "360° Image", icon: Image },
  video: { label: "Video", icon: Video },
  upscaled_video: { label: "Upscaled Video", icon: Video },
  depth_map: { label: "Depth Map", icon: Layers },
  splat_100k: { label: "Splat 100K", icon: Box },
  splat_500k: { label: "Splat 500K", icon: Box },
  splat_full: { label: "Splat Full", icon: Box },
  panorama: { label: "Panorama", icon: Image },
  collider_mesh: { label: "Collider", icon: Box },
  thumbnail: { label: "Thumbnail", icon: Image },
  selected_frame: { label: "Frame", icon: Image },
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

function formatBytes(bytes: number | null): string {
  if (bytes == null || bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function isImageType(type: AssetType): boolean {
  return [
    "equirect_image",
    "panorama",
    "thumbnail",
    "selected_frame",
    "depth_map",
  ].includes(type);
}

function isVideoType(type: AssetType): boolean {
  return ["video", "upscaled_video"].includes(type);
}

interface AssetGalleryProps {
  sceneId: string;
  onClose?: () => void;
}

export function AssetGallery({ sceneId, onClose }: AssetGalleryProps) {
  const { data: assets, isLoading } = useAssets(sceneId);
  const deleteAsset = useDeleteAsset(sceneId);
  const deleteAssets = useDeleteAssets(sceneId);
  const { setMode, setEquirectUrl, setVideoUrl, setDepthUrl } =
    useViewerStore();

  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState<AssetType | "all">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [expandedAsset, setExpandedAsset] = useState<AssetRow | null>(null);

  const availableTypes = useMemo(() => {
    if (!assets) return [];
    const types = new Set(assets.map((a) => a.type));
    return Array.from(types);
  }, [assets]);

  const filteredAssets = useMemo(() => {
    if (!assets) return [];
    if (filter === "all") return assets;
    return assets.filter((a) => a.type === filter);
  }, [assets, filter]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredAssets.map((a) => a.id)));
  }, [filteredAssets]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleView = useCallback(
    (asset: AssetRow) => {
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
      onClose?.();
    },
    [setMode, setEquirectUrl, setVideoUrl, setDepthUrl, onClose],
  );

  const handleDelete = useCallback(
    (assetId: string) => {
      if (!confirm("Delete this asset? This cannot be undone.")) return;
      deleteAsset.mutate(assetId, {
        onSuccess: () => toast.success("Asset deleted"),
        onError: (err) => toast.error(err.message),
      });
    },
    [deleteAsset],
  );

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    if (
      !confirm(`Delete ${selectedIds.size} asset(s)? This cannot be undone.`)
    )
      return;
    deleteAssets.mutate(Array.from(selectedIds), {
      onSuccess: () => {
        toast.success(`${selectedIds.size} asset(s) deleted`);
        setSelectedIds(new Set());
        setBulkMode(false);
      },
      onError: (err) => toast.error(err.message),
    });
  }, [selectedIds, deleteAssets]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-[var(--border-default)]">
        <h2 className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] shrink-0">
          Assets
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setBulkMode(!bulkMode);
              if (bulkMode) clearSelection();
            }}
            className={cn(
              "p-1.5 rounded-md text-xs transition-colors",
              bulkMode
                ? "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]",
            )}
            title="Select"
          >
            <CheckSquare size={13} />
          </button>
          <button
            onClick={() => setView("grid")}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              view === "grid"
                ? "bg-[var(--bg-surface)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
            )}
          >
            <Grid size={13} />
          </button>
          <button
            onClick={() => setView("list")}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              view === "list"
                ? "bg-[var(--bg-surface)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
            )}
          >
            <List size={13} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-1 px-3 sm:px-4 py-1.5 overflow-x-auto border-b border-[var(--border-subtle)] scrollbar-none">
        <Filter size={12} className="text-[var(--text-muted)] shrink-0" />
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "px-2.5 py-1 rounded-full text-xs whitespace-nowrap transition-colors",
            filter === "all"
              ? "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]",
          )}
        >
          All ({assets?.length ?? 0})
        </button>
        {availableTypes.map((type) => {
          const cfg = ASSET_TYPE_CONFIG[type];
          const count = assets?.filter((a) => a.type === type).length ?? 0;
          return (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs whitespace-nowrap transition-colors",
                filter === type
                  ? "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]",
              )}
            >
              {cfg?.label ?? type} ({count})
            </button>
          );
        })}
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {bulkMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-[var(--border-subtle)]"
          >
            <div className="flex items-center gap-2 px-4 py-2">
              <span className="text-xs text-[var(--text-secondary)]">
                {selectedIds.size} selected
              </span>
              <button
                onClick={selectAll}
                className="text-xs text-[var(--accent-primary)] hover:underline"
              >
                Select all
              </button>
              <button
                onClick={clearSelection}
                className="text-xs text-[var(--text-muted)] hover:underline"
              >
                Clear
              </button>
              <div className="flex-1" />
              <button
                onClick={handleBulkDelete}
                disabled={deleteAssets.isPending}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
              >
                {deleteAssets.isPending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Trash2 size={12} />
                )}
                Delete selected
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2
              size={20}
              className="animate-spin text-[var(--text-muted)]"
            />
          </div>
        ) : !filteredAssets.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
            <Box size={32} className="mb-2 opacity-40" />
            <span className="text-sm">No assets yet</span>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <AnimatePresence mode="popLayout">
              {filteredAssets.map((asset) => (
                <AssetGridCard
                  key={asset.id}
                  asset={asset}
                  bulkMode={bulkMode}
                  selected={selectedIds.has(asset.id)}
                  onToggle={() => toggleSelect(asset.id)}
                  onView={() => handleView(asset)}
                  onDelete={() => handleDelete(asset.id)}
                  onExpand={() => setExpandedAsset(asset)}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <AnimatePresence mode="popLayout">
              {filteredAssets.map((asset) => (
                <AssetListRow
                  key={asset.id}
                  asset={asset}
                  bulkMode={bulkMode}
                  selected={selectedIds.has(asset.id)}
                  onToggle={() => toggleSelect(asset.id)}
                  onView={() => handleView(asset)}
                  onDelete={() => handleDelete(asset.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Detail overlay */}
      <AnimatePresence>
        {expandedAsset && (
          <AssetDetailOverlay
            asset={expandedAsset}
            onClose={() => setExpandedAsset(null)}
            onView={() => {
              handleView(expandedAsset);
              setExpandedAsset(null);
            }}
            onDelete={() => {
              handleDelete(expandedAsset.id);
              setExpandedAsset(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Grid Card ── */

function AssetGridCard({
  asset,
  bulkMode,
  selected,
  onToggle,
  onView,
  onDelete,
  onExpand,
}: {
  asset: AssetRow;
  bulkMode: boolean;
  selected: boolean;
  onToggle: () => void;
  onView: () => void;
  onDelete: () => void;
  onExpand: () => void;
}) {
  const cfg = ASSET_TYPE_CONFIG[asset.type];
  const Icon = cfg?.icon ?? Box;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "group relative rounded-lg border overflow-hidden transition-colors cursor-pointer",
        selected
          ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/5"
          : "border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]",
      )}
      onClick={bulkMode ? onToggle : onExpand}
    >
      {/* Thumbnail area */}
      <div className="relative aspect-video bg-[var(--bg-elevated)] flex items-center justify-center overflow-hidden">
        {asset.public_url && isImageType(asset.type) ? (
          <img
            src={asset.public_url}
            alt={cfg?.label ?? asset.type}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : asset.public_url && isVideoType(asset.type) ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <Video
              size={24}
              className="text-[var(--text-muted)] opacity-50"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[8px] border-l-white/80 ml-0.5" />
              </div>
            </div>
          </div>
        ) : (
          <Icon size={24} className="text-[var(--text-muted)] opacity-50" />
        )}

        {/* Bulk checkbox */}
        {bulkMode && (
          <div className="absolute top-2 left-2">
            {selected ? (
              <CheckSquare
                size={16}
                className="text-[var(--accent-primary)]"
              />
            ) : (
              <Square size={16} className="text-[var(--text-muted)]" />
            )}
          </div>
        )}

        {/* Hover actions */}
        {!bulkMode && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            {MODE_FOR_TYPE[asset.type] && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onView();
                }}
                className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
              >
                <Eye size={14} />
              </button>
            )}
            {asset.public_url && (
              <a
                href={asset.public_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
              >
                <Download size={14} />
              </a>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-2 rounded-full bg-white/15 hover:bg-red-500/40 text-white transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          <Icon size={11} className="text-[var(--text-muted)] shrink-0" />
          <span className="text-xs font-medium text-[var(--text-primary)] truncate">
            {cfg?.label ?? asset.type}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-[var(--text-muted)]">
            {formatRelativeTime(asset.created_at)}
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">
            {formatBytes(asset.file_size_bytes)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ── List Row ── */

function AssetListRow({
  asset,
  bulkMode,
  selected,
  onToggle,
  onView,
  onDelete,
}: {
  asset: AssetRow;
  bulkMode: boolean;
  selected: boolean;
  onToggle: () => void;
  onView: () => void;
  onDelete: () => void;
}) {
  const cfg = ASSET_TYPE_CONFIG[asset.type];
  const Icon = cfg?.icon ?? Box;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      className={cn(
        "group flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
        selected
          ? "bg-[var(--accent-primary)]/5 border border-[var(--accent-primary)]"
          : "hover:bg-[var(--bg-surface)] border border-transparent",
      )}
    >
      {bulkMode && (
        <button onClick={onToggle} className="shrink-0">
          {selected ? (
            <CheckSquare
              size={15}
              className="text-[var(--accent-primary)]"
            />
          ) : (
            <Square size={15} className="text-[var(--text-muted)]" />
          )}
        </button>
      )}

      <div className="w-8 h-8 rounded-md bg-[var(--bg-elevated)] flex items-center justify-center shrink-0">
        {asset.public_url && isImageType(asset.type) ? (
          <img
            src={asset.public_url}
            alt=""
            className="w-full h-full object-cover rounded-md"
            loading="lazy"
          />
        ) : (
          <Icon size={14} className="text-[var(--text-muted)]" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-[var(--text-primary)] truncate block">
          {cfg?.label ?? asset.type}
        </span>
        <span className="text-[10px] text-[var(--text-muted)]">
          {formatRelativeTime(asset.created_at)}
          {asset.width && asset.height && ` · ${asset.width}×${asset.height}`}
          {asset.duration_seconds != null &&
            ` · ${asset.duration_seconds.toFixed(1)}s`}
        </span>
      </div>

      <span className="text-[10px] text-[var(--text-muted)] shrink-0">
        {formatBytes(asset.file_size_bytes)}
      </span>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {MODE_FOR_TYPE[asset.type] && (
          <button
            onClick={onView}
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <Eye size={13} />
          </button>
        )}
        {asset.public_url && (
          <a
            href={asset.public_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <Download size={13} />
          </a>
        )}
        <button
          onClick={onDelete}
          className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-red-400 hover:bg-[var(--bg-elevated)] transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </motion.div>
  );
}

/* ── Detail Overlay ── */

function AssetDetailOverlay({
  asset,
  onClose,
  onView,
  onDelete,
}: {
  asset: AssetRow;
  onClose: () => void;
  onView: () => void;
  onDelete: () => void;
}) {
  const cfg = ASSET_TYPE_CONFIG[asset.type];
  const Icon = cfg?.icon ?? Box;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-default)] max-w-lg w-full overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Preview */}
        <div className="relative aspect-video bg-[var(--bg-primary)] flex items-center justify-center">
          {asset.public_url && isImageType(asset.type) ? (
            <img
              src={asset.public_url}
              alt={cfg?.label ?? asset.type}
              className="w-full h-full object-contain"
            />
          ) : asset.public_url && isVideoType(asset.type) ? (
            <video
              src={asset.public_url}
              controls
              className="w-full h-full object-contain"
            />
          ) : (
            <Icon size={48} className="text-[var(--text-muted)] opacity-30" />
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Details */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Icon size={14} className="text-[var(--accent-primary)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {cfg?.label ?? asset.type}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[var(--text-muted)]">Created</span>
              <p className="text-[var(--text-secondary)]">
                {new Date(asset.created_at).toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Size</span>
              <p className="text-[var(--text-secondary)]">
                {formatBytes(asset.file_size_bytes)}
              </p>
            </div>
            {asset.width && asset.height && (
              <div>
                <span className="text-[var(--text-muted)]">Dimensions</span>
                <p className="text-[var(--text-secondary)]">
                  {asset.width} × {asset.height}
                </p>
              </div>
            )}
            {asset.duration_seconds != null && (
              <div>
                <span className="text-[var(--text-muted)]">Duration</span>
                <p className="text-[var(--text-secondary)]">
                  {asset.duration_seconds.toFixed(1)}s
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            {MODE_FOR_TYPE[asset.type] && (
              <button
                onClick={onView}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-[var(--accent-primary)] text-white hover:opacity-90 transition-opacity"
              >
                <Eye size={12} />
                View in Viewer
              </button>
            )}
            {asset.public_url && (
              <a
                href={asset.public_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors"
              >
                <Download size={12} />
                Download
              </a>
            )}
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
