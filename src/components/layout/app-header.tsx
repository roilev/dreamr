"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import {
  ChevronDown,
  ChevronRight,
  Image,
  Video,
  Layers,
  Box,
  FileImage,
  Bug,
  X,
  ExternalLink,
  Copy,
  Pencil,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { useViewerStore } from "@/lib/stores/viewer-store";
import type { AssetRow, PipelineJobRow, SceneInputRow } from "@/lib/supabase/types";
import type { GetSceneResponse } from "@/lib/types/api";
import type { ViewerMode } from "@/lib/types/stores";

interface AppHeaderProps {
  spaceName?: string;
  spaceId?: string;
  sceneName?: string;
  sceneNameSlot?: React.ReactNode;
  overlay?: boolean;
  scene?: GetSceneResponse;
  activeSteps?: string[];
}

const MODE_LABELS: Partial<Record<ViewerMode, string>> = {
  equirect: "360° Image",
  video: "Video",
  depth: "Depth Map",
  splat: "3D World",
  input_canvas: "Input Canvas",
  empty: "Canvas",
};

const ASSET_ICONS: Record<string, typeof Image> = {
  equirect_image: Image,
  video: Video,
  upscaled_video: Video,
  depth_map: Layers,
  splat_100k: Box,
};

const ASSET_LABELS: Record<string, string> = {
  equirect_image: "360° Image",
  video: "Video",
  upscaled_video: "HD Video",
  depth_map: "Depth Map",
  splat_100k: "3D World",
};

const ASSET_TO_MODE: Record<string, ViewerMode> = {
  equirect_image: "equirect",
  video: "video",
  upscaled_video: "video",
  depth_map: "depth",
  splat_100k: "splat",
};

function NavPill({
  children,
  href,
  className = "",
}: {
  children: React.ReactNode;
  href?: string;
  className?: string;
}) {
  const inner = (
    <span className={`relative flex items-center px-4 py-1.5 ${className}`}>
      <span className="absolute -inset-3 rounded-full bg-black/60 blur-2xl pointer-events-none" />
      <span className="relative flex items-center gap-1">{children}</span>
    </span>
  );

  if (href) {
    return <Link href={href} className="shrink-0">{inner}</Link>;
  }
  return <div className="shrink-0 cursor-default">{inner}</div>;
}

/* ── Clipboard ── */
function clip(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
}

/* ── Debug sections ── */
function DebugSection({
  title,
  children,
  defaultOpen = false,
  count,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <span className="flex-1 text-left">{title}</span>
        {count !== undefined && (
          <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
            {count}
          </span>
        )}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function KV({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2 py-0.5">
      <span className="text-[var(--text-muted)] shrink-0">{label}</span>
      <span
        className={cn(
          "text-[var(--text-secondary)] text-right break-all",
          copy && "cursor-pointer hover:text-[var(--accent-primary)]",
        )}
        onClick={copy ? () => clip(value) : undefined}
      >
        {value}
      </span>
    </div>
  );
}

/* ── Contextual Debug ── */
function DebugTab({
  scene,
  activeSteps,
}: {
  scene?: GetSceneResponse;
  activeSteps: string[];
}) {
  const { mode, equirectUrl, videoUrl, depthUrl, inputImages } = useViewerStore();
  const assets: AssetRow[] = (scene?.assets as AssetRow[]) ?? [];
  const inputs: SceneInputRow[] = scene?.inputs ?? [];
  const jobs: PipelineJobRow[] = scene?.jobs ?? [];

  const activeAsset = assets.find((a) => mode === ASSET_TO_MODE[a.type]);
  const relevantJobs = activeAsset
    ? jobs.filter((j) => {
        const stepToType: Record<string, string> = {
          image_360: "equirect_image",
          video: "video",
          upscale: "upscaled_video",
          depth: "depth_map",
        };
        return stepToType[j.step] === activeAsset.type;
      })
    : jobs;

  const currentUrl =
    mode === "equirect" ? equirectUrl :
    mode === "video" ? videoUrl :
    mode === "depth" ? depthUrl :
    null;

  return (
    <div className="max-h-[60vh] overflow-y-auto text-[10px]">
      {/* Current layer info */}
      <DebugSection title={`Active Layer: ${MODE_LABELS[mode] ?? mode}`} defaultOpen>
        <div className="space-y-0.5">
          <KV label="Mode" value={mode} />
          {activeAsset && (
            <>
              <KV label="Asset ID" value={activeAsset.id.slice(0, 12) + "..."} copy />
              <KV label="Type" value={activeAsset.type} />
              {activeAsset.public_url && (
                <div className="flex items-center gap-1 pt-1">
                  <a href={activeAsset.public_url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] hover:underline">
                    Open asset
                  </a>
                  <button onClick={() => clip(activeAsset.public_url!)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                    <Copy size={9} />
                  </button>
                </div>
              )}
            </>
          )}
          {mode === "input_canvas" && (
            <KV label="Canvas images" value={String(inputImages.length)} />
          )}
          {currentUrl && !activeAsset && (
            <div className="flex items-center gap-1 pt-1">
              <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] hover:underline">
                Open URL
              </a>
            </div>
          )}
        </div>
      </DebugSection>

      {/* Scene overview */}
      <DebugSection title="Scene">
        <div className="space-y-0.5">
          <KV label="ID" value={scene?.id ? scene.id.slice(0, 12) + "..." : "—"} copy />
          <KV label="Status" value={scene?.status ?? "—"} />
          <KV label="Step" value={scene?.current_step ?? "idle"} />
        </div>
      </DebugSection>

      <DebugSection title="Prompt" defaultOpen={!!scene?.prompt}>
        {scene?.prompt ? (
          <div className="space-y-1.5">
            <p className="text-[var(--text-secondary)] bg-black/20 rounded-lg px-2.5 py-2 break-words leading-relaxed">
              {scene.prompt}
            </p>
            <button onClick={() => clip(scene.prompt!)} className="flex items-center gap-1 text-[var(--accent-primary)] hover:underline">
              <Copy size={9} /> Copy
            </button>
          </div>
        ) : (
          <p className="text-[var(--text-muted)] italic">No prompt</p>
        )}
      </DebugSection>

      {activeSteps.length > 0 && (
        <DebugSection title="Active Generations" defaultOpen count={activeSteps.length}>
          <div className="flex flex-wrap gap-1">
            {activeSteps.map((step) => (
              <span key={step} className="rounded-full bg-[var(--accent-primary)]/10 px-2 py-0.5 font-medium text-[var(--accent-primary)]">
                {step}
              </span>
            ))}
          </div>
        </DebugSection>
      )}

      {/* Generation jobs filtered to current layer */}
      <DebugSection title={activeAsset ? "Layer History" : "Generation History"} count={relevantJobs.length}>
        {relevantJobs.length === 0 ? (
          <p className="text-[var(--text-muted)]">No jobs</p>
        ) : (
          <div className="space-y-2">
            {relevantJobs.slice(0, 15).map((job) => (
              <div key={job.id} className="rounded-lg bg-black/20 px-2.5 py-2 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[var(--text-primary)]">{job.step}</span>
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 font-medium",
                    job.status === "completed" && "text-green-400 bg-green-400/10",
                    job.status === "failed" && "text-red-400 bg-red-400/10",
                    job.status === "running" && "text-[var(--accent-primary)] bg-[var(--accent-primary)]/10",
                    job.status === "pending" && "text-[var(--text-muted)] bg-white/5",
                  )}>
                    {job.status}
                  </span>
                </div>
                {job.model_id && <KV label="Model" value={job.model_id.split("/").pop() ?? job.model_id} />}
                {job.provider_request_id && (
                  <KV label="Req ID" value={job.provider_request_id.slice(0, 16) + "..."} copy />
                )}
                {job.error_message && (
                  <p className="text-red-400 bg-red-400/5 rounded px-1.5 py-1 break-words mt-1">{job.error_message}</p>
                )}
                {job.input_metadata && Object.keys(job.input_metadata).length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-secondary)]">Input</summary>
                    <pre className="text-[9px] text-[var(--text-muted)] bg-black/30 rounded px-2 py-1 mt-1 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(job.input_metadata, null, 2)}
                    </pre>
                  </details>
                )}
                {job.output_metadata && Object.keys(job.output_metadata).length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-secondary)]">Output</summary>
                    <pre className="text-[9px] text-[var(--text-muted)] bg-black/30 rounded px-2 py-1 mt-1 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(job.output_metadata, null, 2)}
                    </pre>
                  </details>
                )}
                <div className="text-[9px] text-[var(--text-muted)] mt-0.5">
                  {new Date(job.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        )}
      </DebugSection>

      {/* All assets overview */}
      <DebugSection title="All Assets" count={assets.length}>
        {assets.length === 0 ? (
          <p className="text-[var(--text-muted)]">No assets</p>
        ) : (
          <div className="space-y-1">
            {assets.map((asset) => (
              <div key={asset.id} className="flex items-center gap-2 py-0.5">
                <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 font-mono text-[var(--text-muted)]">{asset.type}</span>
                {asset.public_url && (
                  <>
                    <a href={asset.public_url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] hover:underline truncate max-w-[120px]">
                      {asset.storage_path.split("/").pop()}
                    </a>
                    <button onClick={() => clip(asset.public_url!)} className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><Copy size={9} /></button>
                    <a href={asset.public_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><ExternalLink size={9} /></a>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </DebugSection>

      <DebugSection title="Inputs" count={inputs.length}>
        {inputs.length === 0 ? (
          <p className="text-[var(--text-muted)]">No inputs</p>
        ) : (
          <div className="space-y-1">
            {inputs.map((input) => (
              <div key={input.id} className="flex items-center gap-2">
                <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 font-mono text-[var(--text-muted)]">{input.type}</span>
                <span className="text-[var(--text-secondary)]">
                  pos({input.position_x?.toFixed(0)}, {input.position_y?.toFixed(0)}) s({input.position_z?.toFixed(0)})
                </span>
                {input.storage_path && (
                  <a href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/scene-inputs/${input.storage_path}`} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><ExternalLink size={9} /></a>
                )}
              </div>
            ))}
          </div>
        )}
      </DebugSection>

      <div className="px-3 py-2">
        <a href="/admin" target="_blank" className="text-[10px] text-[var(--accent-primary)] hover:underline">Open Admin Dashboard →</a>
      </div>
    </div>
  );
}

/* ── Debug Dropdown (always visible) ── */
function DebugDropdown({
  scene,
  activeSteps,
}: {
  scene?: GetSceneResponse;
  activeSteps: string[];
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
        className="flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-md px-2.5 py-1.5 text-xs font-medium text-white/70 hover:bg-black/60 hover:text-white border border-white/15 transition-all"
      >
        <Bug size={11} />
        Debug
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-white/10 bg-[var(--bg-primary)]/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50"
          >
            <div className="px-3 py-2 border-b border-white/5 flex items-center gap-1.5">
              <Bug size={10} className="text-[var(--accent-primary)]" />
              <span className="text-xs font-medium text-[var(--text-primary)]">Debug</span>
            </div>
            <DebugTab scene={scene} activeSteps={activeSteps} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Main header ── */
export function AppHeader({
  spaceName,
  spaceId,
  sceneName,
  sceneNameSlot,
  overlay,
  scene,
  activeSteps = [],
}: AppHeaderProps) {
  const hasNav = spaceName && spaceId;
  const hasScene = sceneNameSlot || sceneName;

  if (overlay) {
    return (
      <header className="flex items-center justify-between px-5 pt-4 pb-2">
        {/* Left: logo + nav on the same line */}
        <div className="flex items-baseline gap-3">
          {/* Logo */}
          <Link href="/spaces" className="relative shrink-0">
            <span className="absolute -inset-4 rounded-full bg-black/50 blur-2xl pointer-events-none" />
            <span
              className="relative text-2xl italic font-semibold tracking-tight text-white hover:text-white/80 transition-colors"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Dreamr
            </span>
          </Link>

          {/* Breadcrumb */}
          {hasNav && (
            <div className="flex items-baseline gap-1.5">
              <NavPill href={`/spaces/${spaceId}`}>
                <span className="text-[13px] uppercase tracking-wide font-light text-white/70">
                  {spaceName}
                </span>
              </NavPill>

              {hasScene && (
                <>
                  <span className="relative z-10 text-white/25 select-none text-sm font-light">/</span>
                  <NavPill>
                    {sceneNameSlot || (
                      <span className="text-[13px] uppercase tracking-wide font-semibold text-white/90 truncate max-w-[260px]">
                        {sceneName}
                      </span>
                    )}
                    <Pencil size={9} className="text-white/25 hover:text-white/60 transition-colors ml-1" />
                  </NavPill>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <DebugDropdown scene={scene} activeSteps={activeSteps} />
          <div className="relative flex items-center">
            <span className="absolute -inset-3 rounded-full bg-black/60 blur-2xl pointer-events-none" />
            <span className="relative">
              <UserButton appearance={{ elements: { avatarBox: "w-7 h-7" } }} />
            </span>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-2 border-b border-[var(--border-default)] bg-[var(--bg-primary)] px-5">
      <Link
        href="/spaces"
        className="shrink-0 text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
      >
        Dreamr
      </Link>

      {hasNav && (
        <>
          <span className="mx-1 text-[var(--text-muted)] select-none text-xs">/</span>
          <Link
            href={`/spaces/${spaceId}`}
            className="text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors truncate max-w-[200px]"
          >
            {spaceName}
          </Link>
        </>
      )}

      {hasNav && hasScene && (
        <>
          <span className="mx-1 text-[var(--text-muted)] select-none text-xs">/</span>
          {sceneNameSlot || (
            <span className="text-sm font-bold text-[var(--text-primary)] truncate max-w-[240px]">
              {sceneName}
            </span>
          )}
        </>
      )}

      <div className="flex-1" />
      <UserButton appearance={{ elements: { avatarBox: "w-7 h-7" } }} />
    </header>
  );
}
