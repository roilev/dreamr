import type {
  UserRow,
  SpaceRow,
  SceneRow,
  PipelineJobRow,
  AssetRow,
  SceneWorldRow,
  SceneInputRow,
} from "@/lib/supabase/types";

export const mockUser: UserRow = {
  id: "user-001",
  clerk_id: "clerk_user_test123",
  email: "test@dreamr.app",
  display_name: "Test User",
  avatar_url: null,
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
};

export const mockSpace: SpaceRow = {
  id: "proj-001",
  short_id: "aB3kF9mNp2",
  user_id: "user-001",
  name: "My First World",
  description: "A dreamy fantasy landscape",
  thumbnail_url: null,
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
};

export const mockScene: SceneRow = {
  id: "scene-001",
  short_id: "xY7qR2sLm4",
  space_id: "proj-001",
  name: "Enchanted Forest",
  status: "draft",
  current_step: null,
  prompt: "A mystical enchanted forest with bioluminescent plants and ancient trees",
  thumbnail_url: null,
  share_token: null,
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
};

export const mockSceneGenerating: SceneRow = {
  ...mockScene,
  id: "scene-002",
  status: "generating",
  current_step: "image_360",
};

export const mockSceneCompleted: SceneRow = {
  ...mockScene,
  id: "scene-003",
  status: "completed",
  current_step: null,
};

export const mockSceneInput: SceneInputRow = {
  id: "input-001",
  scene_id: "scene-001",
  type: "image",
  content: null,
  storage_path: "user-001/scene-001/reference.png",
  position_x: 0,
  position_y: 0,
  position_z: 0,
  sort_order: 0,
  created_at: "2026-03-01T00:00:00Z",
};

export const mockPipelineJobPending: PipelineJobRow = {
  id: "job-001",
  scene_id: "scene-001",
  step: "image_360",
  status: "pending",
  provider: "fal",
  provider_request_id: null,
  model_id: "fal-ai/nano-banana-2",
  input_metadata: null,
  output_metadata: null,
  error_message: null,
  started_at: null,
  completed_at: null,
  created_at: "2026-03-01T00:00:00Z",
};

export const mockPipelineJobRunning: PipelineJobRow = {
  ...mockPipelineJobPending,
  id: "job-002",
  status: "running",
  started_at: "2026-03-01T00:01:00Z",
};

export const mockPipelineJobCompleted: PipelineJobRow = {
  ...mockPipelineJobPending,
  id: "job-003",
  status: "completed",
  started_at: "2026-03-01T00:01:00Z",
  completed_at: "2026-03-01T00:02:00Z",
  output_metadata: { seed: 42 },
};

export const mockPipelineJobFailed: PipelineJobRow = {
  ...mockPipelineJobPending,
  id: "job-004",
  status: "failed",
  started_at: "2026-03-01T00:01:00Z",
  completed_at: "2026-03-01T00:02:00Z",
  error_message: "Generation failed: model timeout",
};

export const mockAssetEquirect: AssetRow = {
  id: "asset-001",
  scene_id: "scene-001",
  job_id: "job-003",
  type: "equirect_image",
  storage_path: "user-001/scene-001/equirect.png",
  public_url: "https://example.supabase.co/storage/v1/object/public/generated-assets/user-001/scene-001/equirect.png",
  file_size_bytes: 4_200_000,
  width: 4096,
  height: 2048,
  duration_seconds: null,
  metadata: null,
  created_at: "2026-03-01T00:02:00Z",
};

export const mockAssetVideo: AssetRow = {
  id: "asset-002",
  scene_id: "scene-001",
  job_id: "job-003",
  type: "video",
  storage_path: "user-001/scene-001/video.mp4",
  public_url: "https://example.supabase.co/storage/v1/object/public/generated-assets/user-001/scene-001/video.mp4",
  file_size_bytes: 12_000_000,
  width: 1920,
  height: 1080,
  duration_seconds: 5,
  metadata: { fps: 24, codec: "h264" },
  created_at: "2026-03-01T00:03:00Z",
};

export const mockAssetSplat: AssetRow = {
  id: "asset-003",
  scene_id: "scene-001",
  job_id: null,
  type: "splat_100k",
  storage_path: "user-001/scene-001/world.100k.spz",
  public_url: "https://example.supabase.co/storage/v1/object/public/generated-assets/user-001/scene-001/world.100k.spz",
  file_size_bytes: 2_500_000,
  width: null,
  height: null,
  duration_seconds: null,
  metadata: null,
  created_at: "2026-03-01T00:05:00Z",
};

export const mockSceneWorld: SceneWorldRow = {
  id: "world-001",
  scene_id: "scene-001",
  marble_world_id: "marble-world-abc123",
  marble_operation_id: "marble-op-xyz789",
  source_frame_asset_id: "asset-001",
  splat_100k_asset_id: "asset-003",
  splat_500k_asset_id: null,
  splat_full_asset_id: null,
  collider_asset_id: null,
  panorama_asset_id: null,
  status: "completed",
  created_at: "2026-03-01T00:04:00Z",
  completed_at: "2026-03-01T00:05:00Z",
};

// ── Mock fal.ai responses ──

export const mockNanoBanana2Response = {
  images: [
    {
      url: "https://fal.media/files/mock/equirect.png",
      width: 4096,
      height: 2048,
      content_type: "image/png",
    },
  ],
  description: "A seamless 360-degree equirectangular panoramic image",
};

export const mockVeoResponse = {
  video: {
    url: "https://fal.media/files/mock/video.mp4",
    content_type: "video/mp4",
    file_name: "video.mp4",
    file_size: 12_000_000,
  },
};

export const mockDepthResponse = {
  image: {
    url: "https://fal.media/files/mock/depth.png",
    width: 4096,
    height: 2048,
    content_type: "image/png",
  },
};

// ── Mock Marble responses ──

export const mockMarbleOperationPending = {
  operation_id: "marble-op-xyz789",
  status: "PENDING" as const,
  created_at: "2026-03-01T00:04:00Z",
  updated_at: "2026-03-01T00:04:00Z",
};

export const mockMarbleOperationSucceeded = {
  operation_id: "marble-op-xyz789",
  status: "SUCCEEDED" as const,
  result: {
    world_id: "marble-world-abc123",
    assets: {
      splat_100k: { url: "https://marble.mock/100k.spz", file_size: 2_500_000 },
      splat_500k: { url: "https://marble.mock/500k.spz", file_size: 8_000_000 },
      splat_full_res: { url: "https://marble.mock/full.spz", file_size: 25_000_000 },
      collider_mesh: { url: "https://marble.mock/collider.glb", file_size: 500_000 },
      panorama: { url: "https://marble.mock/panorama.png" },
      thumbnail: { url: "https://marble.mock/thumb.png" },
    },
  },
  created_at: "2026-03-01T00:04:00Z",
  updated_at: "2026-03-01T00:05:00Z",
};
