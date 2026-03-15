import { create } from "zustand";
import type { ViewerStore } from "@/lib/types/stores";

export const useViewerStore = create<ViewerStore>((set) => ({
  mode: "empty",
  setMode: (mode) => set({ mode }),

  camera: {
    position: [0, 0, 0],
    target: [0, 0, -1],
    fov: 75,
  },
  setCamera: (camera) =>
    set((state) => ({ camera: { ...state.camera, ...camera } })),

  isXRSupported: false,
  isXRActive: false,
  setXRSupported: (supported) => set({ isXRSupported: supported }),
  setXRActive: (active) => set({ isXRActive: active }),

  equirectUrl: null,
  videoUrl: null,
  depthUrl: null,
  splatUrls: { url100k: null, url500k: null, urlFull: null },
  colliderUrl: null,

  setEquirectUrl: (url) => set({ equirectUrl: url }),
  setVideoUrl: (url) => set({ videoUrl: url }),
  setDepthUrl: (url) => set({ depthUrl: url }),
  setSplatUrls: (urls) =>
    set((state) => ({ splatUrls: { ...state.splatUrls, ...urls } })),
  setColliderUrl: (url) => set({ colliderUrl: url }),

  activeWorld: null,
  setActiveWorld: (world) => set({ activeWorld: world }),

  assets: [],
  setAssets: (assets) => set({ assets }),

  inputImages: [],
  setInputImages: (images) => set({ inputImages: images }),

  initialLookLongitude: null,
  setInitialLookLongitude: (lng) => set({ initialLookLongitude: lng }),

  videoElement: null,
  setVideoElement: (el) => set({ videoElement: el }),

  gyroEnabled: false,
  setGyroEnabled: (enabled) => set({ gyroEnabled: enabled }),
}));
