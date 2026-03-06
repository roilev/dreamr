"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Image,
  Video,
  Layers,
  Box,
  Globe,
  RefreshCw,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useGenerationHistory } from "@/hooks/use-assets";
import { useViewerStore } from "@/lib/stores/viewer-store";
import type { GenerationEvent } from "@/hooks/use-assets";
import type { AssetRow } from "@/lib/supabase/types";

const STEP_LABELS: Record<string, string> = {
  image_360: "360° Image",
  video: "Video Generation",
  upscale: "Video Upscale",
  depth: "Depth Map",
  world: "3D World",
};

const STEP_ICONS: Record<string, typeof Image> = {
  image_360: Image,
  video: Video,
  upscale: Video,
  depth: Layers,
  world: Globe,
};

const STATUS_CONFIG: Record<
  string,
  { color: string; bg: string; icon: typeof CheckCircle }
> = {
  completed: {
    color: "text-emerald-400",
    bg: "bg-emerald-400",
    icon: CheckCircle,
  },
  failed: { color: "text-red-400", bg: "bg-red-400", icon: XCircle },
  running: { color: "text-blue-400", bg: "bg-blue-400", icon: Loader2 },
  pending: { color: "text-[var(--text-muted)]", bg: "bg-[var(--text-muted)]", icon: Clock },
  cancelled: { color: "text-[var(--text-muted)]", bg: "bg-[var(--text-muted)]", icon: XCircle },
};

const ASSET_TYPE_ICONS: Record<string, typeof Image> = {
  equirect_image: Image,
  video: Video,
  upscaled_video: Video,
  depth_map: Layers,
  splat_100k: Box,
  splat_500k: Box,
  splat_full: Box,
  panorama: Image,
  collider_mesh: Box,
  thumbnail: Image,
  selected_frame: Image,
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

function formatDuration(start: string, end?: string): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

interface GenerationHistoryProps {
  sceneId: string;
  onRerun?: (step: string) => void;
}

export function GenerationHistory({
  sceneId,
  onRerun,
}: GenerationHistoryProps) {
  const { data: events, isLoading } = useGenerationHistory(sceneId);
  const { setMode, setEquirectUrl, setVideoUrl, setDepthUrl } =
    useViewerStore();

  const groupedByDate = useMemo(() => {
    if (!events) return [];
    const groups: { date: string; events: GenerationEvent[] }[] = [];
    let currentDate = "";

    for (const event of events) {
      const date = formatDate(event.createdAt);
      if (date !== currentDate) {
        currentDate = date;
        groups.push({ date, events: [] });
      }
      groups[groups.length - 1].events.push(event);
    }

    return groups.reverse();
  }, [events]);

  const handleViewAsset = (asset: AssetRow) => {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (!events?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
        <Clock size={32} className="mb-2 opacity-40" />
        <span className="text-sm">No generation history</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      <div className="px-4 py-3 border-b border-[var(--border-default)]">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          Generation History
        </h2>
        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
          {events.length} generation{events.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <AnimatePresence initial={false}>
          {groupedByDate.map((group) => (
            <div key={group.date} className="mb-4">
              <div className="sticky top-0 z-10 mb-2">
                <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider bg-[var(--bg-primary)] pr-2">
                  {group.date}
                </span>
              </div>

              <div className="relative ml-3 pl-4 border-l border-[var(--border-subtle)]">
                {[...group.events].reverse().map((event, idx) => (
                  <TimelineEvent
                    key={event.id}
                    event={event}
                    index={idx}
                    onRerun={onRerun}
                    onViewAsset={handleViewAsset}
                  />
                ))}
              </div>
            </div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TimelineEvent({
  event,
  index,
  onRerun,
  onViewAsset,
}: {
  event: GenerationEvent;
  index: number;
  onRerun?: (step: string) => void;
  onViewAsset: (asset: AssetRow) => void;
}) {
  const statusCfg = STATUS_CONFIG[event.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;
  const StepIcon = STEP_ICONS[event.step ?? ""] ?? Box;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="relative pb-4 last:pb-0"
    >
      {/* Timeline dot */}
      <div
        className={cn(
          "absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-primary)]",
          statusCfg.bg,
        )}
      />

      <div className="group rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 hover:border-[var(--border-default)] transition-colors">
        {/* Header */}
        <div className="flex items-center gap-2">
          <StepIcon size={13} className={statusCfg.color} />
          <span className="text-xs font-medium text-[var(--text-primary)] flex-1">
            {STEP_LABELS[event.step ?? ""] ?? event.step ?? event.type}
          </span>
          <StatusIcon
            size={13}
            className={cn(
              statusCfg.color,
              event.status === "running" && "animate-spin",
            )}
          />
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[10px] text-[var(--text-muted)]">
            {formatTime(event.createdAt)}
          </span>
          {event.completedAt && (
            <span className="text-[10px] text-[var(--text-muted)]">
              {formatDuration(event.createdAt, event.completedAt)}
            </span>
          )}
          <span
            className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
              event.status === "completed" &&
                "bg-emerald-400/10 text-emerald-400",
              event.status === "failed" && "bg-red-400/10 text-red-400",
              event.status === "running" && "bg-blue-400/10 text-blue-400",
              event.status === "pending" &&
                "bg-[var(--bg-elevated)] text-[var(--text-muted)]",
            )}
          >
            {event.status}
          </span>
        </div>

        {/* Error */}
        {event.error && (
          <div className="mt-2 text-[10px] text-red-400 bg-red-400/5 rounded-md px-2 py-1.5 border border-red-400/10">
            {event.error}
          </div>
        )}

        {/* Output assets */}
        {event.assets && event.assets.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {event.assets.map((asset) => {
              const AssetIcon = ASSET_TYPE_ICONS[asset.type] ?? Box;
              const viewable = MODE_FOR_TYPE[asset.type];
              return (
                <button
                  key={asset.id}
                  onClick={viewable ? () => onViewAsset(asset) : undefined}
                  disabled={!viewable}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] border transition-colors",
                    viewable
                      ? "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] cursor-pointer"
                      : "border-[var(--border-subtle)] text-[var(--text-muted)] cursor-default",
                  )}
                >
                  {viewable ? (
                    <Eye size={10} />
                  ) : (
                    <AssetIcon size={10} />
                  )}
                  {asset.type.replace(/_/g, " ")}
                </button>
              );
            })}
          </div>
        )}

        {/* Re-run button */}
        {onRerun && event.step && event.status !== "running" && (
          <button
            onClick={() => onRerun(event.step!)}
            className="mt-2 flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors opacity-0 group-hover:opacity-100"
          >
            <RefreshCw size={10} />
            Re-run this step
          </button>
        )}
      </div>
    </motion.div>
  );
}
