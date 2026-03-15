"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { CustomUserButton } from "@/components/layout/custom-user-button";

interface AppHeaderProps {
  spaceName?: string;
  spaceId?: string;
  sceneName?: string;
  sceneNameSlot?: React.ReactNode;
  overlay?: boolean;
}

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

/* ── Main header ── */
export function AppHeader({
  spaceName,
  spaceId,
  sceneName,
  sceneNameSlot,
  overlay,
}: AppHeaderProps) {
  const hasNav = spaceName && spaceId;
  const hasScene = sceneNameSlot || sceneName;

  if (overlay) {
    return (
      <header
        className="flex items-center justify-between px-3 sm:px-5 pb-2"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      >
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
              <NavPill href={`/${spaceId}`}>
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

        {/* Right: user button */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center self-center">
            <span className="absolute -inset-3 rounded-full bg-black/60 blur-2xl pointer-events-none" />
            <span className="relative flex items-center">
              <CustomUserButton />
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
        className="shrink-0 text-lg italic font-semibold tracking-tight text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        Dreamr
      </Link>

      {hasNav && (
        <>
          <span className="mx-1 text-[var(--text-muted)] select-none text-xs">/</span>
          <Link
            href={`/${spaceId}`}
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
      <CustomUserButton />
    </header>
  );
}
