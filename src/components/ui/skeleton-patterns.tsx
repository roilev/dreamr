"use client";

import { cn } from "@/lib/utils/cn";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-[var(--bg-surface)]",
        className,
      )}
      {...props}
    />
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 space-y-3">
      <Skeleton className="h-36 w-full rounded-lg" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function SceneCardSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 space-y-2">
      <Skeleton className="aspect-video w-full rounded-lg" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  );
}

export function SceneEditorSkeleton() {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex-1 relative">
        <Skeleton className="absolute inset-0 rounded-none" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </div>
      <div className="px-4 pb-4 pt-2">
        <div className="mx-auto max-w-3xl rounded-2xl bg-[var(--bg-elevated)]/50 border border-[var(--border-subtle)] p-4 space-y-3">
          <div className="flex gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-16 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function AssetGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-video w-full rounded-lg" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function TimelineSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-3 w-3 rounded-full shrink-0 mt-1" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="space-y-2 p-3">
      <Skeleton className="h-8 w-full rounded-lg" />
      <Skeleton className="h-6 w-3/4 rounded-lg" />
      <Skeleton className="h-6 w-5/6 rounded-lg" />
      <Skeleton className="h-6 w-2/3 rounded-lg" />
    </div>
  );
}
