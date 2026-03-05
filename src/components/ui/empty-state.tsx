"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import type { LucideIcon } from "lucide-react";

interface EmptyStateWithLucideIcon {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  size?: "sm" | "md" | "lg";
}

interface EmptyStateWithReactNode {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

type EmptyStateProps = EmptyStateWithLucideIcon | EmptyStateWithReactNode;

function isLucideIcon(
  icon: unknown,
): icon is LucideIcon {
  return typeof icon === "function";
}

function isActionObject(
  action: unknown,
): action is { label: string; onClick: () => void } {
  return (
    typeof action === "object" &&
    action !== null &&
    "label" in action &&
    "onClick" in action
  );
}

const sizeMap = {
  sm: { icon: 24, title: "text-sm", desc: "text-xs", gap: "gap-2" },
  md: { icon: 36, title: "text-base", desc: "text-sm", gap: "gap-3" },
  lg: { icon: 48, title: "text-lg", desc: "text-base", gap: "gap-4" },
} as const;

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  size = "md",
}: EmptyStateProps) {
  const s = sizeMap[size];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "flex flex-col items-center justify-center",
        s.gap,
        className,
      )}
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
        className="rounded-2xl bg-[var(--bg-surface)] p-4"
      >
        {isLucideIcon(icon) ? (
          (() => {
            const Icon = icon;
            return (
              <Icon
                size={s.icon}
                className="text-[var(--text-muted)]"
                strokeWidth={1.5}
              />
            );
          })()
        ) : (
          <span className="text-[var(--text-muted)]">{icon}</span>
        )}
      </motion.div>
      <div className="text-center space-y-1">
        <p
          className={cn(
            "font-medium text-[var(--text-secondary)]",
            s.title,
          )}
        >
          {title}
        </p>
        {description && (
          <p className={cn("text-[var(--text-muted)] max-w-xs", s.desc)}>
            {description}
          </p>
        )}
      </div>
      {action &&
        (isActionObject(action) ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={action.onClick}
            className="mt-2 rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-primary)] transition-colors hover:opacity-90"
          >
            {action.label}
          </motion.button>
        ) : (
          <div className="mt-2">{action as ReactNode}</div>
        ))}
    </motion.div>
  );
}
