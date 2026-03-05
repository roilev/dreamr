"use client";

import { useAssets } from "@/hooks/use-assets";
import { useViewerStore } from "@/lib/stores/viewer-store";
import { Image, Video, Box, Layers, Download } from "lucide-react";
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
}

export function AssetPanel({ sceneId, floating }: AssetPanelProps) {
  const { data: assets } = useAssets(sceneId);
  const { mode, setMode, setEquirectUrl, setVideoUrl, setDepthUrl } = useViewerStore();

  const handleSelect = (asset: AssetRow) => {
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
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-3">
      <span className="mb-1 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
        Assets
      </span>
      {assets.map((asset) => {
        const Icon = ASSET_ICONS[asset.type] ?? Box;
        const isActive = mode === MODE_FOR_TYPE[asset.type];
        return (
          <button
            key={asset.id}
            onClick={() => handleSelect(asset)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
              isActive
                ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]",
            )}
          >
            <Icon size={14} />
            <span className="flex-1 text-left truncate">{ASSET_LABELS[asset.type] ?? asset.type}</span>
            {asset.public_url && (
              <a
                href={asset.public_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[var(--text-muted)] hover:text-[var(--accent-primary)]"
              >
                <Download size={12} />
              </a>
            )}
          </button>
        );
      })}
    </div>
  );
}
