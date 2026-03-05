"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface SharedSceneHeaderProps {
  name: string;
  prompt: string | null;
}

export function SharedSceneHeader({ name, prompt }: SharedSceneHeaderProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="absolute top-0 left-0 right-0 z-20">
      <div
        className={cn(
          "flex items-start justify-between gap-4 px-5 py-4 transition-all duration-300",
          "bg-gradient-to-b from-black/70 via-black/30 to-transparent",
        )}
      >
        <div className="flex-1 min-w-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 group"
          >
            <h1 className="text-base font-medium text-white truncate">
              {name}
            </h1>
            {prompt && (
              <span className="text-white/30 group-hover:text-white/50 transition-colors">
                {expanded ? (
                  <ChevronUp size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
              </span>
            )}
          </button>
          {expanded && prompt && (
            <p className="mt-1 text-xs text-white/40 line-clamp-2 max-w-lg">
              {prompt}
            </p>
          )}
        </div>

        <a
          href={process.env.NEXT_PUBLIC_APP_URL || "/"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 shrink-0 rounded-full bg-white/10 backdrop-blur-sm px-3 py-1.5 text-xs text-white/70 hover:bg-white/20 hover:text-white transition-all border border-white/10"
        >
          Open in Dreamr
          <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}
