"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2,
  FileImage,
  X,
  Video,
  Box,
  Image,
  Play,
  Pause,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Sparkles,
  Wand2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useUpdateScene } from "@/hooks/use-scene";
import { useRunStep, useGenerateWorld } from "@/hooks/use-fal";
import { useQueryClient } from "@tanstack/react-query";
import { useViewerStore } from "@/lib/stores/viewer-store";
import { cn } from "@/lib/utils/cn";
import { PIPELINE_STEP_LABELS } from "@/lib/utils/constants";
import { useWorldGenerationStatus } from "@/hooks/use-world";
import type { SceneInputRow, AssetRow } from "@/lib/supabase/types";
import type { GetSceneResponse, PipelineStepName } from "@/lib/types/api";
import type { ViewerMode } from "@/lib/types/stores";

type WorkflowType = "equirect" | "panorama";
type PromptMode = "precise" | "creative";

interface ControlCenterProps {
  sceneId: string;
  scene: GetSceneResponse | undefined;
  initialPrompt?: string;
  imageInputs?: SceneInputRow[];
  activeSteps: string[];
  videoUrl?: string | null;
  showTimeline?: boolean;
  onGenerationStarted?: (step: string) => void;
  onCaptureFrame?: (blob: Blob, timeSeconds: number) => void;
}

/* ── Tab definitions ── */

interface TabDef {
  key: string;
  icon: typeof Image;
  label: string;
  assetTypes: string[];
  viewerMode: ViewerMode;
  pipelineStep: PipelineStepName | "world" | null;
  acceptsPrompt: boolean;
  referenceType: "input_canvas" | "equirect_image" | "video" | "none";
}

const TABS: TabDef[] = [
  {
    key: "canvas",
    icon: FileImage,
    label: "Canvas",
    assetTypes: [],
    viewerMode: "input_canvas",
    pipelineStep: null,
    acceptsPrompt: false,
    referenceType: "none",
  },
  {
    key: "image",
    icon: Sparkles,
    label: "Image",
    assetTypes: ["equirect_image"],
    viewerMode: "equirect",
    pipelineStep: "image_360",
    acceptsPrompt: true,
    referenceType: "input_canvas",
  },
  {
    key: "video",
    icon: Video,
    label: "Video",
    assetTypes: ["video", "upscaled_video"],
    viewerMode: "video",
    pipelineStep: "video",
    acceptsPrompt: true,
    referenceType: "equirect_image",
  },
  {
    key: "world",
    icon: Box,
    label: "3D World",
    assetTypes: ["splat_100k", "splat_500k", "splat_full"],
    viewerMode: "splat",
    pipelineStep: "world",
    acceptsPrompt: true,
    referenceType: "equirect_image",
  },
];

/* ── Inline mini-timeline ── */
const ASSUMED_FPS = 30;

function MiniTimeline() {
  const video = useViewerStore((s) => s.videoElement);
  const trackRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!video) return;
    const syncDuration = () => setDuration(video.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    if (video.readyState >= 1) syncDuration();
    video.addEventListener("loadedmetadata", syncDuration);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onPause);
    setPlaying(!video.paused);
    const tick = () => { setCurrentTime(video.currentTime); rafRef.current = requestAnimationFrame(tick); };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      video.removeEventListener("loadedmetadata", syncDuration);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onPause);
    };
  }, [video]);

  const toggle = () => {
    if (!video) return;
    if (video.paused) { video.play().catch(() => {}); setPlaying(true); }
    else { video.pause(); setPlaying(false); }
  };
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const t = trackRef.current;
    if (!t || !video || !duration) return;
    const r = t.getBoundingClientRect();
    video.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration;
  };
  const stepFrame = (dir: -1 | 1) => {
    if (!video) return;
    if (!video.paused) { video.pause(); setPlaying(false); }
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + dir / ASSUMED_FPS));
  };

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const fmt = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 100);
    return `${m}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  if (!video) return null;

  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="flex items-center gap-2">
        <button onClick={() => stepFrame(-1)} className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors">
          <ChevronLeft size={12} />
        </button>
        <button onClick={toggle} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
          {playing ? <Pause size={10} /> : <Play size={10} className="ml-0.5" />}
        </button>
        <button onClick={() => stepFrame(1)} className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors">
          <ChevronRightIcon size={12} />
        </button>
        <span className="text-[10px] text-white/70 tabular-nums whitespace-nowrap ml-auto">
          {fmt(currentTime)} / {fmt(duration)}
        </span>
      </div>
      <div className="relative" style={{ height: 28 }}>
        <div ref={trackRef} onClick={seek} className="absolute bottom-0 left-0 right-0 h-2 rounded-full bg-white/8 cursor-pointer group">
          <div className="absolute inset-y-0 left-0 rounded-full bg-white/30" style={{ width: `${pct}%` }} />
          <div className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white shadow-sm shadow-black/30 opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `${pct}%`, marginLeft: -6 }} />
        </div>
        {duration > 0 && <div className="absolute top-0 bottom-0 w-px bg-white/60 pointer-events-none" style={{ left: `${pct}%` }} />}
      </div>
    </div>
  );
}

/* ── Reference thumbnail ── */
const VIDEO_EXTS = /\.(mp4|webm|mov|ogg)(\?|#|$)/i;

function RefThumb({ url, onRemove, fallbackIcon, isVideo }: {
  url: string | null; onRemove?: () => void; fallbackIcon?: React.ReactNode; isVideo?: boolean;
}) {
  const isVideoUrl = isVideo || (url ? VIDEO_EXTS.test(url) : false);
  return (
    <div className="group relative h-9 w-12 shrink-0">
      <div className="h-full w-full overflow-hidden rounded-lg border border-white/10">
        {url && isVideoUrl ? (
          <div className="flex h-full w-full items-center justify-center bg-white/5 text-white/50"><Video size={14} /></div>
        ) : url ? (
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/5 text-[var(--text-muted)]">{fallbackIcon ?? <FileImage size={14} />}</div>
        )}
      </div>
      {onRemove && (
        <button onClick={onRemove} className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow-md group-hover:flex z-10"><X size={8} /></button>
      )}
    </div>
  );
}

/* ── Version dropdown ── */
const VIDEO_TYPES = new Set(["video", "upscaled_video"]);

function AssetThumb({ asset }: { asset: AssetRow }) {
  if (!asset.public_url) return null;
  if (VIDEO_TYPES.has(asset.type)) return <div className="flex h-5 w-7 items-center justify-center rounded border border-white/10 bg-white/5"><Video size={10} className="text-white/50" /></div>;
  return <img src={asset.public_url} alt="" className="h-5 w-7 rounded object-cover border border-white/10" />;
}

function VersionDropdown({ assets, onSelect }: { assets: AssetRow[]; onSelect: (asset: AssetRow) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  if (assets.length <= 1) return null;
  return (
    <div className="relative z-50" ref={ref}>
      <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }} className="ml-0.5 flex items-center gap-0.5 text-[9px] text-white/50 hover:text-white/80 transition-colors">
        <ChevronDown size={8} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 rounded-xl border border-white/10 bg-[var(--bg-primary)] backdrop-blur-xl shadow-2xl overflow-hidden z-[100]">
          <div className="p-1.5 space-y-0.5">
            {assets.map((a, i) => {
              const date = new Date(a.created_at);
              const label = `v${assets.length - i} — ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
              return (
                <button key={a.id} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(a); setOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-all cursor-pointer">
                  <AssetThumb asset={a} /><span className="flex-1 text-left truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Workflow selector (equirect / panorama) ── */
function WorkflowSelector({ value, onChange }: { value: WorkflowType; onChange: (v: WorkflowType) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-white/5 p-0.5">
      {(["equirect", "panorama"] as const).map((wf) => (
        <button
          key={wf}
          onClick={() => onChange(wf)}
          className={cn(
            "px-2.5 py-1 text-[10px] font-medium rounded-md transition-all",
            value === wf
              ? "bg-white/15 text-white"
              : "text-white/40 hover:text-white/60",
          )}
        >
          {wf === "equirect" ? "Equirect" : "Panorama"}
        </button>
      ))}
    </div>
  );
}

/* ── Prompt mode toggle (precise / creative) ── */
function PromptModeToggle({ value, onChange }: { value: PromptMode; onChange: (v: PromptMode) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-white/5 p-0.5">
      {(["precise", "creative"] as const).map((mode) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={cn(
            "px-2 py-1 text-[10px] font-medium rounded-md transition-all",
            value === mode
              ? "bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]"
              : "text-white/40 hover:text-white/60",
          )}
        >
          {mode === "precise" ? "Precise" : "Creative"}
        </button>
      ))}
    </div>
  );
}

/* ── Enhance button with dropdown ── */
function EnhanceButton({
  sceneId,
  canUpscale,
  canDepth,
  isUpscaling,
  isDepthGenerating,
  depthEnabled,
  onToggleDepth,
  onRunUpscale,
  onRunDepth,
}: {
  sceneId: string;
  canUpscale: boolean;
  canDepth: boolean;
  isUpscaling: boolean;
  isDepthGenerating: boolean;
  depthEnabled: boolean;
  onToggleDepth: () => void;
  onRunUpscale: () => void;
  onRunDepth: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all",
          "bg-white/8 hover:bg-white/12 text-white/70 hover:text-white",
          (isUpscaling || isDepthGenerating) && "text-[var(--accent-primary)]",
        )}
      >
        <Wand2 size={12} />
        Enhance
        {(isUpscaling || isDepthGenerating) && <Loader2 size={10} className="animate-spin" />}
        <ChevronDown size={8} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 bottom-full mb-2 w-52 rounded-xl border border-white/10 bg-[var(--bg-primary)] backdrop-blur-xl shadow-2xl overflow-hidden z-[100]"
          >
            <div className="p-2 space-y-1">
              <button
                onClick={() => { onRunUpscale(); setOpen(false); }}
                disabled={!canUpscale || isUpscaling}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition-all hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="flex-1 text-left text-white/80">Upscale</span>
                {isUpscaling && <Loader2 size={10} className="animate-spin text-[var(--accent-primary)]" />}
              </button>
              <div className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs">
                <span className="flex-1 text-left text-white/80">Depth / Parallax</span>
                <button
                  onClick={() => {
                    if (!depthEnabled && canDepth) onRunDepth();
                    onToggleDepth();
                  }}
                  className={cn(
                    "relative h-5 w-9 rounded-full transition-colors",
                    depthEnabled ? "bg-[var(--accent-primary)]" : "bg-white/15",
                  )}
                >
                  <div className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all",
                    depthEnabled ? "left-4.5" : "left-0.5",
                  )} />
                </button>
                {isDepthGenerating && <Loader2 size={10} className="animate-spin text-[var(--accent-primary)]" />}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Main Control Center ── */
export function ControlCenter({
  sceneId,
  scene,
  initialPrompt,
  imageInputs,
  activeSteps,
  videoUrl,
  showTimeline,
  onGenerationStarted,
}: ControlCenterProps) {
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const [activeTab, setActiveTab] = useState<string>("canvas");
  const [workflow, setWorkflow] = useState<WorkflowType>("equirect");
  const [promptMode, setPromptMode] = useState<PromptMode>("precise");
  const [depthEnabled, setDepthEnabled] = useState(false);

  const updateScene = useUpdateScene(sceneId);
  const runStep = useRunStep(sceneId);
  const generateWorld = useGenerateWorld(sceneId);
  const queryClient = useQueryClient();
  const { setMode, setEquirectUrl, setVideoUrl: setStoreVideoUrl, setDepthUrl, setSplatUrls } = useViewerStore();
  const { data: worldGenStatus } = useWorldGenerationStatus(sceneId);
  const worldIsGenerating = worldGenStatus?.status === "pending" || worldGenStatus?.status === "running";

  useEffect(() => setPrompt(initialPrompt ?? ""), [initialPrompt]);

  const assets = (scene?.assets ?? []) as AssetRow[];
  const images = imageInputs ?? [];
  const hasInputImages = images.length > 0;

  const currentTab = TABS.find((t) => t.key === activeTab) ?? TABS[0];
  const assetsForTab = (tab: TabDef): AssetRow[] =>
    tab.assetTypes.length > 0 ? assets.filter((a) => tab.assetTypes.includes(a.type)) : [];

  const equirectAsset = assets.find((a) => a.type === "equirect_image");
  const videoAsset = assets.find((a) => a.type === "video" || a.type === "upscaled_video");
  const hasRawVideo = assets.some((a) => a.type === "video");
  const hasUpscaled = assets.some((a) => a.type === "upscaled_video");
  const hasDepthMap = assets.some((a) => a.type === "depth_map");
  const hasAnyVisual = !!equirectAsset || !!videoAsset;
  const videoElement = useViewerStore((s) => s.videoElement);
  const viewerMode = useViewerStore((s) => s.mode);

  const isStepActive = useCallback((step: string) => activeSteps.includes(step), [activeSteps]);

  const selectTab = (tab: TabDef) => {
    setActiveTab(tab.key);
    const tabAssets = assetsForTab(tab);
    const latestAsset = tabAssets[0];

    if (tab.key === "canvas") { setMode("input_canvas"); return; }
    if (tab.viewerMode === "splat") {
      const vs = useViewerStore.getState();
      if (vs.splatUrls.urlFull || vs.splatUrls.url100k) setMode("splat");
      else if (latestAsset?.public_url) { setSplatUrls({ urlFull: latestAsset.public_url }); setMode("splat"); }
      return;
    }
    if (latestAsset?.public_url) {
      const url = latestAsset.public_url;
      switch (tab.viewerMode) {
        case "equirect": setEquirectUrl(url); break;
        case "video": setStoreVideoUrl(url); break;
        case "depth": setDepthUrl(url); break;
      }
      setMode(depthEnabled && tab.key === "image" && hasDepthMap ? "depth" : tab.viewerMode);
    } else if (tab.viewerMode === "input_canvas") {
      setMode("input_canvas");
    }
  };

  const selectVersion = (tab: TabDef, asset: AssetRow) => {
    const url = asset.public_url ?? "";
    switch (tab.viewerMode) {
      case "equirect": setEquirectUrl(url); break;
      case "video": setStoreVideoUrl(url); break;
      case "depth": setDepthUrl(url); break;
      case "splat": {
        const key = asset.type === "splat_100k" ? "url100k" : asset.type === "splat_500k" ? "url500k" : "urlFull";
        setSplatUrls({ [key]: url });
        break;
      }
    }
    setMode(tab.viewerMode);
  };

  const canGenerate = (tab: TabDef): boolean => {
    if (!tab.pipelineStep) return false;
    switch (tab.key) {
      case "image": return true;
      case "video": return !!equirectAsset;
      case "world": return hasAnyVisual;
      default: return false;
    }
  };

  async function captureCurrentFrame(): Promise<string | null> {
    const vid = videoElement;
    if (!vid || viewerMode !== "video") return null;
    const canvas = document.createElement("canvas");
    canvas.width = vid.videoWidth;
    canvas.height = vid.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(vid, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return null;
    const formData = new FormData();
    formData.append("frame", blob, "frame.png");
    const res = await fetch(`/api/scenes/${sceneId}/capture-frame`, { method: "POST", body: formData });
    if (!res.ok) return null;
    const { publicUrl } = await res.json();
    return publicUrl as string;
  }

  const handleSubmit = async () => {
    if (!canGenerate(currentTab)) return;

    if (currentTab.key === "image") {
      if (!(prompt.trim() || hasInputImages)) return;
      if (isStepActive("image_360")) return;
      try {
        if (prompt.trim()) await updateScene.mutateAsync({ prompt: prompt.trim() });
        runStep.mutate(
          { step: "image_360", options: { workflow, promptMode } },
          {
            onSuccess: () => { toast.success("360° image generation started"); onGenerationStarted?.("image_360"); },
            onError: (e) => toast.error(e.message),
          },
        );
      } catch { toast.error("Failed to start generation"); }
    } else if (currentTab.key === "world") {
      if (isStepActive("world") || worldIsGenerating) return;
      if (currentTab.acceptsPrompt && prompt.trim()) {
        await updateScene.mutateAsync({ prompt: prompt.trim() }).catch(() => {});
      }
      if (viewerMode === "video" && videoElement) {
        toast.info("Capturing current frame...");
        const frameUrl = await captureCurrentFrame();
        if (!frameUrl) { toast.error("Failed to capture frame"); return; }
        generateWorld.mutate(
          { imageUrl: frameUrl },
          { onSuccess: () => { toast.success("3D world generation started"); onGenerationStarted?.("world"); }, onError: (e) => toast.error(e.message) },
        );
      } else if (equirectAsset) {
        generateWorld.mutate(
          { frameAssetId: equirectAsset.id },
          { onSuccess: () => { toast.success("3D world generation started"); onGenerationStarted?.("world"); }, onError: (e) => toast.error(e.message) },
        );
      }
    } else {
      const step = currentTab.pipelineStep as PipelineStepName;
      if (isStepActive(step)) return;
      if (currentTab.acceptsPrompt && prompt.trim()) {
        await updateScene.mutateAsync({ prompt: prompt.trim() }).catch(() => {});
      }
      runStep.mutate(
        { step },
        {
          onSuccess: () => { toast.success(`${PIPELINE_STEP_LABELS[step as keyof typeof PIPELINE_STEP_LABELS] || step} started`); onGenerationStarted?.(step); },
          onError: (e) => toast.error(e.message),
        },
      );
    }
  };

  const handleRunUpscale = () => {
    if (isStepActive("upscale")) return;
    runStep.mutate(
      { step: "upscale" },
      {
        onSuccess: () => { toast.success("Upscale started"); onGenerationStarted?.("upscale"); },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const handleRunDepth = () => {
    if (isStepActive("depth")) return;
    runStep.mutate(
      { step: "depth" },
      {
        onSuccess: () => { toast.success("Depth generation started"); onGenerationStarted?.("depth"); },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const handleToggleDepth = () => {
    const next = !depthEnabled;
    setDepthEnabled(next);
    if (next && hasDepthMap) {
      const depthAsset = assets.find((a) => a.type === "depth_map");
      if (depthAsset?.public_url) { setDepthUrl(depthAsset.public_url); setMode("depth"); }
    } else if (!next && activeTab === "image" && equirectAsset?.public_url) {
      setEquirectUrl(equirectAsset.public_url);
      setMode("equirect");
    }
  };

  const removeInput = async (inputId: string) => {
    await fetch(`/api/scenes/${sceneId}/inputs/${inputId}`, { method: "DELETE" }).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ["scene", sceneId] });
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  function renderReferences() {
    switch (currentTab.referenceType) {
      case "input_canvas":
        if (images.length === 0) return null;
        return (
          <div className="flex items-center gap-1.5">
            {images.map((input) => {
              const thumbUrl = input.storage_path ? `${supabaseUrl}/storage/v1/object/public/scene-inputs/${input.storage_path}` : null;
              return <RefThumb key={input.id} url={thumbUrl} onRemove={() => removeInput(input.id)} />;
            })}
          </div>
        );
      case "equirect_image":
        if (!equirectAsset?.public_url) return null;
        return <RefThumb url={equirectAsset.public_url} fallbackIcon={<Image size={14} />} />;
      case "video":
        if (!videoAsset?.public_url) return null;
        return <RefThumb url={videoAsset.public_url} isVideo fallbackIcon={<Video size={14} />} />;
      default:
        return null;
    }
  }

  const isTabStepActive = isStepActive(currentTab.pipelineStep ?? "");
  const canSubmit = currentTab.key === "image"
    ? (prompt.trim() || hasInputImages) && !isTabStepActive && canGenerate(currentTab)
    : !isTabStepActive && canGenerate(currentTab);
  const showSubmit = currentTab.pipelineStep !== null;

  return (
    <div className="px-4 pb-4 pt-2 pb-safe">
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative mx-auto max-w-3xl rounded-2xl bg-[var(--bg-elevated)]/80 backdrop-blur-xl border border-[var(--border-default)] shadow-2xl shadow-black/40"
      >
        {/* Tab bar */}
        <div className="flex items-center border-b border-white/8 px-1">
          {TABS.map((tab) => {
            const count = assetsForTab(tab).length;
            const isActiveTab = activeTab === tab.key;
            const Icon = tab.icon;
            const processing = isStepActive(tab.pipelineStep ?? "") || (tab.key === "world" && worldIsGenerating);
            const tabAssets = assetsForTab(tab);

            return (
              <div key={tab.key} className="relative flex items-center">
                <motion.button
                  onClick={() => selectTab(tab)}
                  whileTap={{ scale: 0.97 }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium relative rounded-lg transition-colors",
                    isActiveTab ? "text-white" : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]",
                  )}
                >
                  {processing ? (
                    <Loader2 size={11} className="animate-spin text-[var(--accent-primary)]" />
                  ) : (
                    <Icon size={11} className={isActiveTab ? "opacity-100" : "opacity-70"} />
                  )}
                  <span className="hidden sm:inline">{tab.label}</span>
                  <AnimatePresence>
                    {count > 0 && (
                      <motion.span
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className={cn("ml-0.5 rounded-full px-1.5 py-px text-[9px] font-semibold leading-none", isActiveTab ? "bg-white/20 text-white" : "bg-white/10 text-white/60")}
                      >
                        {count}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {isActiveTab && (
                    <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-2 right-2 h-[1.5px] rounded-full bg-white/70" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                  )}
                </motion.button>
                <AnimatePresence>
                  {tabAssets.length > 1 && isActiveTab && (
                    <motion.div initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -4 }} transition={{ duration: 0.15 }}>
                      <VersionDropdown assets={tabAssets} onSelect={(a) => selectVersion(tab, a)} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Active generation bar */}
        <AnimatePresence>
          {(activeSteps.length > 0 || worldIsGenerating) && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden border-b border-white/5">
              <div className="flex items-center gap-2 px-4 py-2">
                {activeSteps.map((s) => (
                  <motion.div key={s} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-1.5 rounded-full bg-[var(--accent-primary)]/10 px-3 py-1 text-xs font-medium text-[var(--accent-primary)]">
                    <Loader2 size={10} className="animate-spin" />
                    {PIPELINE_STEP_LABELS[s as keyof typeof PIPELINE_STEP_LABELS] || s}
                  </motion.div>
                ))}
                {worldIsGenerating && !activeSteps.includes("world") && (
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-1.5 rounded-full bg-[var(--accent-primary)]/10 px-3 py-1 text-xs font-medium text-[var(--accent-primary)]">
                    <Loader2 size={10} className="animate-spin" /> 3D World
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* References row */}
        <AnimatePresence>
          {renderReferences() && (
            <motion.div key={`ref-${currentTab.referenceType}`} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">{renderReferences()}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timeline */}
        <AnimatePresence>
          {activeTab === "video" && showTimeline && videoUrl && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden px-4 border-t border-white/5">
              <MiniTimeline />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Prompt input */}
        <AnimatePresence>
          {currentTab.acceptsPrompt && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmit()}
                  placeholder={
                    currentTab.key === "image" && hasInputImages
                      ? "Describe what to create from these images..."
                      : currentTab.key === "video"
                        ? "Describe the animation / motion..."
                        : "Describe your world..."
                  }
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image tab controls: workflow + prompt mode + enhance (below prompt) */}
        <AnimatePresence>
          {activeTab === "image" && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-t border-white/5 flex-wrap">
                <WorkflowSelector value={workflow} onChange={setWorkflow} />
                <PromptModeToggle value={promptMode} onChange={setPromptMode} />
                <div className="flex-1" />
                {equirectAsset && (
                  <EnhanceButton
                    sceneId={sceneId}
                    canUpscale={hasRawVideo && !hasUpscaled}
                    canDepth={hasAnyVisual && !isStepActive("depth")}
                    isUpscaling={isStepActive("upscale")}
                    isDepthGenerating={isStepActive("depth")}
                    depthEnabled={depthEnabled}
                    onToggleDepth={handleToggleDepth}
                    onRunUpscale={handleRunUpscale}
                    onRunDepth={handleRunDepth}
                  />
                )}
                <motion.button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  whileHover={canSubmit ? { scale: 1.08 } : undefined}
                  whileTap={canSubmit ? { scale: 0.95 } : undefined}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full transition-colors shrink-0",
                    canSubmit ? "bg-[var(--text-primary)] text-[var(--bg-primary)]" : "bg-white/10 text-[var(--text-muted)] cursor-not-allowed",
                  )}
                >
                  {isTabStepActive ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit (non-image tabs) */}
        <AnimatePresence>
          {showSubmit && activeTab !== "image" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-end px-4 pb-3 pt-1">
              <motion.button
                onClick={handleSubmit}
                disabled={!canSubmit}
                whileHover={canSubmit ? { scale: 1.08 } : undefined}
                whileTap={canSubmit ? { scale: 0.95 } : undefined}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                  canSubmit ? "bg-[var(--text-primary)] text-[var(--bg-primary)]" : "bg-white/10 text-[var(--text-muted)] cursor-not-allowed",
                )}
              >
                {isTabStepActive ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
