"use client";

import { useState, useMemo } from "react";
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
  ChevronDown,
  ChevronRight,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useGenerationHistory } from "@/hooks/use-assets";
import { useViewerStore } from "@/lib/stores/viewer-store";
import { useIsAdmin } from "@/hooks/use-is-admin";
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

function clip(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

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
  const { isAdmin } = useIsAdmin();

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
    <div className="flex flex-col bg-[var(--bg-primary)]">
      <div className="overflow-y-auto px-4 py-3">
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
                    isAdmin={isAdmin}
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
  isAdmin,
}: {
  event: GenerationEvent;
  index: number;
  onRerun?: (step: string) => void;
  onViewAsset: (asset: AssetRow) => void;
  isAdmin: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = STATUS_CONFIG[event.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;
  const StepIcon = STEP_ICONS[event.step ?? ""] ?? Box;

  const hasPipelineDetails = isAdmin && event.outputMetadata &&
    Object.keys(event.outputMetadata).some((k) => k.startsWith("step_") || k === "intermediates");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="relative pb-4 last:pb-0"
    >
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
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
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
          {isAdmin && event.provider && (
            <span className="text-[10px] text-[var(--text-muted)]">
              {event.provider}/{event.modelId?.split("/").pop() ?? ""}
            </span>
          )}
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

        {/* Admin: expand toggle for pipeline details */}
        {hasPipelineDetails && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 flex items-center gap-1 text-[10px] text-[var(--accent-primary)] hover:text-[var(--accent-primary)]/80 transition-colors"
          >
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            Pipeline details
          </button>
        )}

        {/* Admin: expanded pipeline step details */}
        {expanded && hasPipelineDetails && (
          <AdminPipelineDetails
            outputMetadata={event.outputMetadata!}
            inputMetadata={event.inputMetadata}
          />
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

interface PipelineStage {
  label: string;
  prompt?: string;
  description?: string;
  dimensions?: { width?: number; height?: number };
  inputImages: { label: string; url: string }[];
  outputImages: { label: string; url: string }[];
}

function buildStagesFromStepKeys(
  outputMetadata: Record<string, unknown>,
  inputMetadata?: Record<string, unknown>,
): PipelineStage[] {
  const stages: PipelineStage[] = [];
  const stepEntries = Object.entries(outputMetadata)
    .filter(([k]) => k.startsWith("step_"))
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [key, val] of stepEntries) {
    const step = val as Record<string, unknown>;
    if (key === "step_4_finalize") continue;

    const label = key
      .replace("step_", "")
      .replace(/_/g, " ")
      .replace(/^\d+\s/, (m) => `Step ${m.trim()}: `);

    const inputImages: { label: string; url: string }[] = [];
    const outputImages: { label: string; url: string }[] = [];

    if (key === "step_1_generate") {
      const refUrls = step.reference_urls as string[] | undefined;
      if (refUrls?.length) {
        refUrls.forEach((url, i) => inputImages.push({ label: `Reference ${i + 1}`, url }));
      }
      if (step.raw_url) outputImages.push({ label: "Generated panorama", url: step.raw_url as string });
    } else if (key === "step_2_seam") {
      if (step.crop_url) inputImages.push({ label: "Seam crop", url: step.crop_url as string });
      if (step.inpainted_url) outputImages.push({ label: "Inpainted", url: step.inpainted_url as string });
      if (step.fixed_url) outputImages.push({ label: "Seam fixed", url: step.fixed_url as string });
    } else if (key === "step_3_poles") {
      const inters = step.intermediates as Record<string, string> | undefined;
      if (inters) {
        if (inters.wrapped) inputImages.push({ label: "Wrapped equirect", url: inters.wrapped });
        if (inters.letterboxed) inputImages.push({ label: "Letterboxed", url: inters.letterboxed });
        if (inters.captureTop || inters.poleTop)
          inputImages.push({ label: "Top capture", url: inters.captureTop || inters.poleTop });
        if (inters.captureBottom || inters.poleBottom)
          inputImages.push({ label: "Bottom capture", url: inters.captureBottom || inters.poleBottom });
      }
      if (step.filled_top_url) outputImages.push({ label: "Filled top", url: step.filled_top_url as string });
      if (step.filled_bottom_url) outputImages.push({ label: "Filled bottom", url: step.filled_bottom_url as string });
    }

    stages.push({
      label,
      prompt: step.prompt as string | undefined,
      description: step.description as string | undefined,
      dimensions: step.dimensions as { width?: number; height?: number } | undefined,
      inputImages,
      outputImages,
    });
  }
  return stages;
}

function buildStagesFromIntermediates(
  intermediates: Record<string, string>,
  inputMetadata?: Record<string, unknown>,
  outputMetadata?: Record<string, unknown>,
): PipelineStage[] {
  const stages: PipelineStage[] = [];
  const userPrompt = inputMetadata?.user_prompt as string | undefined;
  const workflow = (outputMetadata?.workflow ?? inputMetadata?.workflow) as string | undefined;
  const promptMode = (outputMetadata?.prompt_mode ?? inputMetadata?.prompt_mode) as string | undefined;

  let fullPrompt: string | undefined;
  if (userPrompt && workflow && promptMode) {
    const sysPrompts: Record<string, Record<string, string>> = {
      equirect: {
        precise: "Generate a seamless 360-degree equirectangular panoramic image. The image must have a 2:1 aspect ratio with the full 360 horizontal field of view. The left edge and right edge must connect seamlessly when wrapped into a sphere. The top represents the zenith (straight up) and the bottom the nadir (straight down). The scene: ",
        creative: "Format: 360 equirectangular. Generate an immersive, photorealistic world. Make it feel like we are standing inside this scene as it unfolds around us. Full spherical coverage, seamless wrap at edges. The scene: ",
      },
      panorama: {
        precise: "Generate a 4:1 panoramic strip showing a full 360° horizontal view. The strip should connect seamlessly left-to-right when wrapped into a cylinder. The scene: ",
        creative: "Format: 4:1 panoramic strip. Generate an immersive, photorealistic world as a 360° panoramic band. Seamless left-right wrap when rolled into a cylinder. The scene: ",
      },
    };
    const sys = sysPrompts[workflow]?.[promptMode];
    fullPrompt = sys ? `${sys}${userPrompt}` : userPrompt;
  } else {
    fullPrompt = userPrompt || undefined;
  }

  if (intermediates.raw) {
    stages.push({
      label: "Step 1: Generate",
      prompt: fullPrompt,
      inputImages: [],
      outputImages: [{ label: "Generated panorama", url: intermediates.raw }],
    });
  }

  const seamInputs: { label: string; url: string }[] = [];
  const seamOutputs: { label: string; url: string }[] = [];
  if (intermediates.seamCrop) seamInputs.push({ label: "Seam crop", url: intermediates.seamCrop });
  if (intermediates.seamFixed) seamOutputs.push({ label: "Seam fixed", url: intermediates.seamFixed });
  if (seamInputs.length || seamOutputs.length) {
    stages.push({
      label: "Step 2: Seam fix",
      prompt: "The photo has a missing seam region running vertically through the center where the left and right edges meet. Seamlessly repair this seam area so the left and right halves blend naturally, continuing the scene smoothly across the repair zone.",
      inputImages: seamInputs,
      outputImages: seamOutputs,
    });
  }

  const poleInputs: { label: string; url: string }[] = [];
  const poleOutputs: { label: string; url: string }[] = [];
  if (intermediates.wrapped) poleInputs.push({ label: "Wrapped equirect", url: intermediates.wrapped });
  if (intermediates.letterboxed) poleInputs.push({ label: "Letterboxed", url: intermediates.letterboxed });
  if (intermediates.captureTop || intermediates.poleTop)
    poleInputs.push({ label: "Top capture", url: (intermediates.captureTop || intermediates.poleTop) });
  if (intermediates.captureBottom || intermediates.poleBottom)
    poleInputs.push({ label: "Bottom capture", url: (intermediates.captureBottom || intermediates.poleBottom) });
  if (poleInputs.length) {
    stages.push({
      label: "Step 3: Pole fill",
      prompt: "Fill the missing region in this wide-angle photo. Complete the missing areas to seamlessly match the surrounding environment's surfaces, textures, lighting, and objects. DO NOT CHANGE THE REST OF THE SCENE.",
      inputImages: poleInputs,
      outputImages: poleOutputs,
    });
  }

  return stages;
}

function AdminPipelineDetails({
  outputMetadata,
  inputMetadata,
}: {
  outputMetadata: Record<string, unknown>;
  inputMetadata?: Record<string, unknown>;
}) {
  const hasStepKeys = Object.keys(outputMetadata).some((k) => k.startsWith("step_"));
  const intermediates = outputMetadata.intermediates as Record<string, string> | undefined;

  const stages = hasStepKeys
    ? buildStagesFromStepKeys(outputMetadata, inputMetadata)
    : intermediates
      ? buildStagesFromIntermediates(intermediates, inputMetadata, outputMetadata)
      : [];

  return (
    <div className="mt-2 space-y-1.5 text-[10px]">
      {stages.map((stage, i) => (
        <StageCollapsible key={i} stage={stage} defaultOpen={i === 0} />
      ))}

      <details className="rounded-lg bg-black/20 px-2.5 py-2">
        <summary className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-[9px] font-medium">
          Raw metadata
        </summary>
        <pre className="text-[9px] text-[var(--text-muted)] bg-black/30 rounded px-2 py-1 mt-1 overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify({ input: inputMetadata, output: outputMetadata }, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function StageCollapsible({ stage, defaultOpen }: { stage: PipelineStage; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div className="rounded-lg bg-black/20 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-[9px] font-medium text-[var(--text-primary)] hover:bg-white/[0.03] transition-colors"
      >
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <span className="flex-1 text-left capitalize">{stage.label}</span>
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 space-y-2.5">
          {/* ── Input ── */}
          <div>
            <p className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Input</p>
            {stage.inputImages.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {stage.inputImages.map((img) => (
                  <a key={img.label} href={img.url} target="_blank" rel="noopener noreferrer" className="block">
                    <img src={img.url} alt={img.label} className="h-16 rounded border border-white/10 object-cover" />
                    <span className="text-[7px] text-[var(--text-muted)] block mt-0.5 truncate max-w-[80px]">{img.label}</span>
                  </a>
                ))}
              </div>
            ) : (
              <span className="text-[9px] text-[var(--text-muted)] italic">Text prompt only</span>
            )}
          </div>

          {/* ── Prompt ── */}
          <div>
            <p className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Prompt</p>
            {stage.prompt ? (
              <>
                <p className="text-[var(--text-secondary)] bg-black/30 rounded px-2 py-1.5 break-words text-[9px] leading-relaxed">
                  {stage.prompt}
                </p>
                <button
                  onClick={() => clip(stage.prompt!)}
                  className="flex items-center gap-1 mt-1 text-[var(--accent-primary)] hover:underline text-[8px]"
                >
                  <Copy size={7} /> Copy
                </button>
              </>
            ) : (
              <span className="text-[9px] text-[var(--text-muted)] italic">Not stored (legacy job)</span>
            )}
            {stage.description && (
              <p className="text-[var(--text-muted)] bg-black/20 rounded px-2 py-1 mt-1.5 break-words text-[8px] italic">
                Model: {stage.description}
              </p>
            )}
          </div>

          {/* ── Output ── */}
          <div>
            <p className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Output</p>
            {stage.outputImages.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {stage.outputImages.map((img) => (
                  <a key={img.label} href={img.url} target="_blank" rel="noopener noreferrer" className="block">
                    <img src={img.url} alt={img.label} className="h-16 rounded border border-white/10 object-cover" />
                    <span className="text-[7px] text-[var(--text-muted)] block mt-0.5 truncate max-w-[80px]">{img.label}</span>
                  </a>
                ))}
              </div>
            ) : (
              <span className="text-[9px] text-[var(--text-muted)] italic">Not stored (legacy job)</span>
            )}
            {stage.dimensions && (
              <span className="text-[8px] text-[var(--text-muted)] block mt-1">
                {stage.dimensions.width}×{stage.dimensions.height}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
