"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils/cn";

interface EnhancedTooltipProps {
  content: string;
  shortcut?: string[];
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
}

export function EnhancedTooltip({
  content,
  shortcut,
  side = "top",
  children,
}: EnhancedTooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          {children}
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            className={cn(
              "z-50 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)]",
              "px-3 py-1.5 text-xs text-[var(--text-secondary)] shadow-lg",
              "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            )}
          >
            <div className="flex items-center gap-2">
              <span>{content}</span>
              {shortcut && (
                <div className="flex gap-0.5 ml-1">
                  {shortcut.map((key, i) => (
                    <kbd
                      key={i}
                      className="inline-flex h-4 min-w-[16px] items-center justify-center rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1 text-[9px] font-medium text-[var(--text-muted)]"
                    >
                      {key === "Mod" ? "⌘" : key}
                    </kbd>
                  ))}
                </div>
              )}
            </div>
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
