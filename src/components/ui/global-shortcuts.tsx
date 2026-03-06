"use client";

import {
  useKeyboardShortcuts,
  useDreamrShortcuts,
  KeyboardShortcutsHelp,
} from "./keyboard-shortcuts";

export function GlobalShortcuts() {
  useKeyboardShortcuts();
  useDreamrShortcuts();

  return <KeyboardShortcutsHelp />;
}
