/**
 * Store interface types — Zustand store shapes.
 *
 * The foundation agent defines these; Agent B implements them.
 */

import type {
  SceneRow,
  PipelineJobRow,
  AssetRow,
  PipelineStep,
  SceneWorldRow,
} from "@/lib/supabase/types";

// ── Scene Store ──

export interface SceneStore {
  scene: SceneRow | null;
  inputs: SceneInputData[];
  setScene: (scene: SceneRow | null) => void;
  setInputs: (inputs: SceneInputData[]) => void;
  updateScene: (partial: Partial<SceneRow>) => void;
}

export interface SceneInputData {
  id: string;
  type: "image" | "text";
  content: string | null;
  storagePath: string | null;
  publicUrl: string | null;
  positionX: number;
  positionY: number;
  positionZ: number;
  sortOrder: number;
}

// ── Pipeline Store ──

export interface PipelineStore {
  jobs: PipelineJobRow[];
  currentStep: PipelineStep | null;
  isGenerating: boolean;
  setJobs: (jobs: PipelineJobRow[]) => void;
  updateJob: (job: PipelineJobRow) => void;
  addJob: (job: PipelineJobRow) => void;
  reset: () => void;
}

// ── Viewer Store ──

export type ViewerMode =
  | "empty"
  | "input_canvas"
  | "equirect"
  | "video"
  | "depth"
  | "splat"
  | "loading";

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export interface ViewerStore {
  mode: ViewerMode;
  setMode: (mode: ViewerMode) => void;

  camera: CameraState;
  setCamera: (camera: Partial<CameraState>) => void;

  isXRSupported: boolean;
  isXRActive: boolean;
  setXRSupported: (supported: boolean) => void;
  setXRActive: (active: boolean) => void;

  equirectUrl: string | null;
  videoUrl: string | null;
  depthUrl: string | null;
  splatUrls: { url100k: string | null; url500k: string | null; urlFull: string | null };
  colliderUrl: string | null;

  setEquirectUrl: (url: string | null) => void;
  setVideoUrl: (url: string | null) => void;
  setDepthUrl: (url: string | null) => void;
  setSplatUrls: (urls: Partial<ViewerStore["splatUrls"]>) => void;
  setColliderUrl: (url: string | null) => void;

  activeWorld: SceneWorldRow | null;
  setActiveWorld: (world: SceneWorldRow | null) => void;

  assets: AssetRow[];
  setAssets: (assets: AssetRow[]) => void;

  inputImages: ViewerInputImage[];
  setInputImages: (images: ViewerInputImage[]) => void;

  initialLookLongitude: number | null;
  setInitialLookLongitude: (lng: number | null) => void;

  videoElement: HTMLVideoElement | null;
  setVideoElement: (el: HTMLVideoElement | null) => void;

  gyroEnabled: boolean;
  setGyroEnabled: (enabled: boolean) => void;
}

export interface ViewerInputImage {
  id: string;
  url: string;
  longitude: number;
  latitude: number;
  angularSize: number;
  needsPlacement?: boolean;
}
