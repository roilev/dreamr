"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Check,
  Link2,
  Code,
  X,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";

interface ShareDialogProps {
  sceneId: string;
  sceneName: string;
  open: boolean;
  onClose: () => void;
}

export function ShareDialog({
  sceneId,
  sceneName,
  open,
  onClose,
}: ShareDialogProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const generateLink = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/scenes/${sceneId}/share`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setShareUrl(data.shareUrl);
    } catch {
      toast.error("Failed to generate share link");
    } finally {
      setLoading(false);
    }
  }, [sceneId]);

  const revokeLink = useCallback(async () => {
    setRevoking(true);
    try {
      const res = await fetch(`/api/scenes/${sceneId}/share`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setShareUrl(null);
      toast.success("Share link revoked");
    } catch {
      toast.error("Failed to revoke share link");
    } finally {
      setRevoking(false);
    }
  }, [sceneId]);

  const copyToClipboard = useCallback(
    async (text: string, type: "link" | "embed") => {
      await navigator.clipboard.writeText(text);
      if (type === "link") {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedEmbed(true);
        setTimeout(() => setCopiedEmbed(false), 2000);
      }
      toast.success(type === "link" ? "Link copied!" : "Embed code copied!");
    },
    [],
  );

  const shareToTwitter = useCallback(() => {
    if (!shareUrl) return;
    const text = `Check out "${sceneName}" on Dreamr`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }, [shareUrl, sceneName]);

  const embedCode = shareUrl
    ? `<iframe src="${shareUrl}/embed" width="800" height="600" frameborder="0" allowfullscreen></iframe>`
    : "";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-medium text-[var(--text-primary)]">
                Share Scene
              </h2>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {!shareUrl ? (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="rounded-full bg-[var(--bg-elevated)] p-4">
                  <Link2 size={24} className="text-[var(--text-secondary)]" />
                </div>
                <p className="text-sm text-[var(--text-secondary)] text-center max-w-xs">
                  Generate a public link so anyone can view this scene without
                  signing in.
                </p>
                <button
                  onClick={generateLink}
                  disabled={loading}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all",
                    "bg-[var(--accent-primary)] text-[var(--bg-primary)] hover:opacity-90",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Link2 size={14} />
                  )}
                  Generate Share Link
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1.5 block">
                    Share link
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={shareUrl}
                      className="flex-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none select-all"
                    />
                    <button
                      onClick={() => copyToClipboard(shareUrl, "link")}
                      className="shrink-0 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)] p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors"
                    >
                      {copiedLink ? (
                        <Check size={16} className="text-[var(--success)]" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={shareToTwitter}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4 fill-current"
                      aria-hidden="true"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    Share on X
                  </button>
                  <button
                    onClick={() => copyToClipboard(embedCode, "embed")}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors"
                  >
                    {copiedEmbed ? (
                      <Check size={14} className="text-[var(--success)]" />
                    ) : (
                      <Code size={14} />
                    )}
                    Copy Embed
                  </button>
                </div>

                <div className="pt-2 border-t border-[var(--border-subtle)]">
                  <button
                    onClick={revokeLink}
                    disabled={revoking}
                    className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--error)] transition-colors disabled:opacity-50"
                  >
                    {revoking ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Trash2 size={12} />
                    )}
                    Revoke share link
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
