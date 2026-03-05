"use client";

import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "glow-border bg-[var(--bg-surface)] p-4",
        className,
      )}
      {...props}
    />
  );
}
