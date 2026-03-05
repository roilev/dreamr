"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppStore {
  adminMode: boolean;
  toggleAdminMode: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      adminMode: false,
      toggleAdminMode: () => set((s) => ({ adminMode: !s.adminMode })),
    }),
    { name: "dreamr-app" },
  ),
);
