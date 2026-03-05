import { cn } from "@/lib/utils/cn";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-[var(--bg-surface)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="glow-border bg-[var(--bg-surface)] p-5">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    </div>
  );
}

export function SceneEditorSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="flex flex-1">
        <div className="flex-1 bg-[var(--bg-primary)]">
          <Skeleton className="h-full w-full" />
        </div>
        <div className="w-60 border-l border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    </div>
  );
}
