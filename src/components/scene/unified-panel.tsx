"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, FolderOpen, Clock, Activity } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { AssetGallery } from "./asset-gallery";
import { GenerationHistory } from "./generation-history";
import { PIPELINE_STEP_LABELS } from "@/lib/utils/constants";

type PanelTab = "library" | "timeline";

interface UnifiedPanelProps {
  sceneId: string;
  activeSteps: string[];
  onClose: () => void;
  defaultTab?: PanelTab;
}

const TABS: { key: PanelTab; label: string; icon: typeof Activity }[] = [
  { key: "library", label: "Library", icon: FolderOpen },
  { key: "timeline", label: "Timeline", icon: Clock },
];

export function UnifiedPanel({ sceneId, activeSteps, onClose, defaultTab = "library" }: UnifiedPanelProps) {
  const [tab, setTab] = useState<PanelTab>(
    activeSteps.length > 0 ? "timeline" : defaultTab,
  );

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Tab bar */}
      <div className="flex border-b border-[var(--border-default)]">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.key;
          const jobCount = t.key === "timeline" ? activeSteps.length : 0;

          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "relative flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors",
                isActive
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
              )}
            >
              <Icon size={12} />
              {t.label}
              {jobCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]">
                  {jobCount}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="unified-panel-tab"
                  className="absolute bottom-0 inset-x-4 h-[2px] rounded-full bg-[var(--accent-primary)]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {tab === "library" && (
            <motion.div
              key="library"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full overflow-hidden"
            >
              <AssetGallery sceneId={sceneId} onClose={onClose} />
            </motion.div>
          )}
          {tab === "timeline" && (
            <motion.div
              key="timeline"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full overflow-y-auto"
            >
              <TimelineView sceneId={sceneId} activeSteps={activeSteps} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RunningJobs({ activeSteps }: { activeSteps: string[] }) {
  if (activeSteps.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">
        {activeSteps.length} active job{activeSteps.length !== 1 ? "s" : ""}
      </p>
      {activeSteps.map((step) => (
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-[var(--accent-primary)]/20 bg-[var(--accent-primary)]/5 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <Loader2 size={18} className="animate-spin text-[var(--accent-primary)]" />
              <div className="absolute inset-0 animate-ping opacity-20">
                <Loader2 size={18} className="text-[var(--accent-primary)]" />
              </div>
            </div>
            <div className="flex-1">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {PIPELINE_STEP_LABELS[step as keyof typeof PIPELINE_STEP_LABELS] || step}
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-[var(--accent-primary)] font-medium">Running</span>
                <div className="flex gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1 h-1 rounded-full bg-[var(--accent-primary)]"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function TimelineView({ sceneId, activeSteps }: { sceneId: string; activeSteps: string[] }) {
  return (
    <div className="p-4 space-y-4">
      <RunningJobs activeSteps={activeSteps} />
      {activeSteps.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-[var(--text-muted)]">
          <Activity size={24} className="mb-2 opacity-40" />
          <span className="text-xs">No active jobs</span>
        </div>
      )}
      <div className="pt-2 border-t border-[var(--border-default)]">
        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium mb-3">
          History
        </p>
        <GenerationHistory sceneId={sceneId} />
      </div>
    </div>
  );
}
