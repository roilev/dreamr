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

function GlowWrap({
  children,
  href,
}: {
  children: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <span className="relative inline-flex items-center">
      <span className="absolute -inset-x-3 -inset-y-2 rounded-xl bg-black/60 blur-lg pointer-events-none" />
      <span className="relative flex items-center gap-1">{children}</span>
    </span>
  );

  if (href) {
    return <Link href={href} className="shrink-0">{inner}</Link>;
  }
  return <span className="shrink-0">{inner}</span>;
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
        {/* Left: logo + nav */}
        <div className="flex items-center gap-3">
          <GlowWrap href="/spaces">
            <span
              className="text-2xl italic font-semibold tracking-tight text-white hover:text-white/80 transition-colors"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Dreamr
            </span>
          </GlowWrap>

          {hasNav && (
            <div className="flex items-center gap-1.5">
              <span className="text-white/25 select-none text-sm font-light">/</span>
              <GlowWrap href={`/${spaceId}`}>
                <span className="text-[13px] uppercase tracking-wide font-light text-white/70">
                  {spaceName}
                </span>
              </GlowWrap>

              {hasScene && (
                <>
                  <span className="text-white/25 select-none text-sm font-light">/</span>
                  <GlowWrap>
                    {sceneNameSlot || (
                      <span className="text-[13px] uppercase tracking-wide font-semibold text-white/90 truncate max-w-[200px] sm:max-w-[260px]">
                        {sceneName}
                      </span>
                    )}
                    <Pencil size={9} className="text-white/25 hover:text-white/60 transition-colors ml-1" />
                  </GlowWrap>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: user button */}
        <div className="flex items-center">
          <span className="relative inline-flex items-center">
            <span className="absolute -inset-x-3 -inset-y-2 rounded-xl bg-black/60 blur-lg pointer-events-none" />
            <span className="relative"><CustomUserButton /></span>
          </span>
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
