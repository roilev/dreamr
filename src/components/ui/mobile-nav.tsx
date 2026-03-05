"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { FolderOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: "/spaces", icon: FolderOpen, label: "Spaces" },
  { href: "/", icon: Sparkles, label: "Home" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around border-t border-[var(--border-default)] bg-[var(--bg-primary)]/90 backdrop-blur-md md:hidden">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] transition-colors",
              isActive ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)]",
            )}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
