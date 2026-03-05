/**
 * API contract types — request/response shapes for every API route.
 *
 * Agent A implements these as route handlers.
 * Agent B consumes them in React Query hooks.
 */

import type {
  SpaceRow,
  SceneRow,
  SceneInputRow,
  PipelineJobRow,
  AssetRow,
  SceneWorldRow,
} from "@/lib/supabase/types";

// ── Spaces ──

export interface CreateSpaceRequest {
  name: string;
  description?: string;
}

export type CreateSpaceResponse = SpaceRow;

export type ListSpacesResponse = SpaceRow[];

export interface UpdateSpaceRequest {
  name?: string;
  description?: string;
}

export type UpdateSpaceResponse = SpaceRow;

// ── Scenes ──

export interface CreateSceneRequest {
  name?: string;
  prompt?: string;
}

export type CreateSceneResponse = SceneRow;

export type ListScenesResponse = SceneRow[];

export interface UpdateSceneRequest {
  name?: string;
  prompt?: string;
}

export type UpdateSceneResponse = SceneRow;

export type GetSceneResponse = SceneRow & {
  inputs: SceneInputRow[];
  jobs: PipelineJobRow[];
  assets: AssetRow[];
  worlds: SceneWorldRow[];
};

// ── Scene Inputs ──

export interface AddSceneInputRequest {
  type: "image" | "text";
  content?: string;
  storage_path?: string;
  position_x?: number;
  position_y?: number;
  position_z?: number;
  sort_order?: number;
}

export type AddSceneInputResponse = SceneInputRow;

// ── Pipeline (per-step) ──

export type PipelineStepName = "image_360" | "video" | "upscale" | "depth";

export interface RunStepRequest {
  step: PipelineStepName;
  options?: {
    veoModel?: "fal-ai/veo3.1/image-to-video" | "fal-ai/veo3.1" | "fal-ai/veo3/fast";
    depthModel?: "fal-ai/image-preprocessors/depth-anything/v2" | "fal-ai/imageutils/marigold-depth";
    imageUrl?: string;
  };
}

export interface RunStepResponse {
  status: "step_started";
  step: PipelineStepName;
}

export interface GenerateWorldRequest {
  frameAssetId: string;
}

export interface GenerateWorldResponse {
  status: "world_generation_started";
}

// ── Upload ──

export interface UploadRequest {
  fileName: string;
  contentType: string;
  bucket: "scene-inputs" | "generated-assets";
  path: string;
}

export interface UploadResponse {
  signedUrl: string;
  storagePath: string;
}

// ── Assets ──

export type ListAssetsResponse = AssetRow[];

// ── Generic error ──

export interface ApiError {
  error: string;
  details?: string;
}
