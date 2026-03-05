import { create } from "zustand";
import type { SceneStore } from "@/lib/types/stores";

export const useSceneStore = create<SceneStore>((set) => ({
  scene: null,
  inputs: [],
  setScene: (scene) => set({ scene }),
  setInputs: (inputs) => set({ inputs }),
  updateScene: (partial) =>
    set((state) => ({
      scene: state.scene ? { ...state.scene, ...partial } : null,
    })),
}));
