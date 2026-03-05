"use client";

import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { PIPELINE_STEPS, PIPELINE_STEP_LABELS } from "@/lib/utils/constants";
import { Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import * as Tooltip from "@radix-ui/react-tooltip";

export function PipelineProgress() {
  const { jobs, isGenerating } = usePipelineStore();

  if (!isGenerating && jobs.length === 0) return null;

  return (
    <Tooltip.Provider delayDuration={200}>
      <div className="flex items-center gap-1 ml-auto">
        {PIPELINE_STEPS.map((step, i) => {
          const job = jobs.find((j) => j.step === step);
          const status = job?.status ?? "pending";

          return (
            <div key={step} className="flex items-center gap-1">
              {i > 0 && (
                <div
                  className={cn(
                    "h-px w-3",
                    status === "completed" ? "bg-[var(--success)]" : "bg-[var(--border-default)]",
                  )}
                />
              )}
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <div
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold transition-all",
                      status === "completed" && "bg-[var(--success)] text-white",
                      status === "running" && "bg-[var(--accent-primary)] text-white shadow-[0_0_12px_var(--accent-glow)]",
                      status === "failed" && "bg-[var(--error)] text-white",
                      status === "pending" && "bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-default)]",
                    )}
                  >
                    {status === "completed" && <Check size={10} />}
                    {status === "running" && <Loader2 size={10} className="animate-spin" />}
                    {status === "failed" && <X size={10} />}
                    {status === "pending" && <span>{i + 1}</span>}
                  </div>
                </Tooltip.Trigger>
                <Tooltip.Content
                  side="bottom"
                  className="rounded-md bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--text-primary)] shadow-lg border border-[var(--border-default)]"
                >
                  {PIPELINE_STEP_LABELS[step]}
                  {status !== "pending" && (
                    <span className="ml-1 text-[var(--text-muted)] capitalize">({status})</span>
                  )}
                </Tooltip.Content>
              </Tooltip.Root>
            </div>
          );
        })}
      </div>
    </Tooltip.Provider>
  );
}
