"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, X } from "lucide-react";

interface Shortcut {
  keys: string[];
  label: string;
  category: string;
  action: () => void;
}

const shortcuts: Map<string, Shortcut> = new Map();

export function registerShortcut(id: string, shortcut: Shortcut) {
  shortcuts.set(id, shortcut);
  return () => {
    shortcuts.delete(id);
  };
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      const key = [
        e.metaKey || e.ctrlKey ? "Mod" : "",
        e.shiftKey ? "Shift" : "",
        e.altKey ? "Alt" : "",
        e.key.toUpperCase(),
      ]
        .filter(Boolean)
        .join("+");

      for (const shortcut of shortcuts.values()) {
        const shortcutKey = shortcut.keys.join("+").toUpperCase();
        if (key === shortcutKey) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    return registerShortcut("help", {
      keys: ["?"],
      label: "Show keyboard shortcuts",
      category: "General",
      action: () => setOpen((prev) => !prev),
    });
  }, []);

  const categories = new Map<string, Shortcut[]>();
  for (const shortcut of shortcuts.values()) {
    const list = categories.get(shortcut.category) ?? [];
    list.push(shortcut);
    categories.set(shortcut.category, list);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)] shadow-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Keyboard
                  size={18}
                  className="text-[var(--text-muted)]"
                />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Keyboard Shortcuts
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {Array.from(categories.entries()).map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
                    {category}
                  </h3>
                  <div className="space-y-1">
                    {items.map((shortcut, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-1.5"
                      >
                        <span className="text-sm text-[var(--text-secondary)]">
                          {shortcut.label}
                        </span>
                        <div className="flex gap-1">
                          {shortcut.keys.map((key, j) => (
                            <kbd
                              key={j}
                              className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-1.5 text-[10px] font-medium text-[var(--text-muted)]"
                            >
                              {key === "Mod"
                                ? typeof navigator !== "undefined" &&
                                  navigator.platform.includes("Mac")
                                  ? "⌘"
                                  : "Ctrl"
                                : key}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] text-center">
              <span className="text-xs text-[var(--text-muted)]">
                Press{" "}
                <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-1 text-[10px]">
                  ?
                </kbd>{" "}
                to toggle
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function useDreamrShortcuts() {
  useEffect(() => {
    const cleanups: (() => void)[] = [];

    cleanups.push(
      registerShortcut("new-scene", {
        keys: ["Mod", "N"],
        label: "New scene",
        category: "Navigation",
        action: () => {},
      }),
    );

    cleanups.push(
      registerShortcut("search", {
        keys: ["Mod", "K"],
        label: "Search",
        category: "Navigation",
        action: () => {},
      }),
    );

    cleanups.push(
      registerShortcut("toggle-sidebar", {
        keys: ["Mod", "B"],
        label: "Toggle sidebar",
        category: "Navigation",
        action: () => {},
      }),
    );

    return () => cleanups.forEach((fn) => fn());
  }, []);
}
