/**
 * Database types — manually defined to match migrations.
 * Replace with `supabase gen types typescript` output when running against a live instance.
 */

export type SceneStatus =
  | "draft"
  | "generating"
  | "completed"
  | "failed"
  | "archived";

export type PipelineStep =
  | "image_360"
  | "video"
  | "upscale"
  | "depth"
  | "world";

export type InputType = "image" | "text";

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type AssetType =
  | "equirect_image"
  | "video"
  | "upscaled_video"
  | "depth_map"
  | "splat_100k"
  | "splat_500k"
  | "splat_full"
  | "collider_mesh"
  | "panorama"
  | "thumbnail"
  | "selected_frame";

// ── Row types ──

export interface UserRow {
  id: string;
  clerk_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpaceRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

/** @deprecated Use SpaceRow. Kept for backward compatibility during projects→spaces migration. */
export type ProjectRow = SpaceRow;

export interface SceneRow {
  id: string;
  space_id: string;
  name: string;
  status: SceneStatus;
  current_step: PipelineStep | null;
  prompt: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SceneInputRow {
  id: string;
  scene_id: string;
  type: InputType;
  content: string | null;
  storage_path: string | null;
  position_x: number;
  position_y: number;
  position_z: number;
  sort_order: number;
  created_at: string;
}

export interface PipelineJobRow {
  id: string;
  scene_id: string;
  step: PipelineStep;
  status: JobStatus;
  provider: string | null;
  provider_request_id: string | null;
  model_id: string | null;
  input_metadata: Record<string, unknown> | null;
  output_metadata: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AssetRow {
  id: string;
  scene_id: string;
  job_id: string | null;
  type: AssetType;
  storage_path: string;
  public_url: string | null;
  file_size_bytes: number | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface SceneWorldRow {
  id: string;
  scene_id: string;
  marble_world_id: string | null;
  marble_operation_id: string | null;
  source_frame_asset_id: string | null;
  splat_100k_asset_id: string | null;
  splat_500k_asset_id: string | null;
  splat_full_asset_id: string | null;
  collider_asset_id: string | null;
  panorama_asset_id: string | null;
  status: JobStatus;
  created_at: string;
  completed_at: string | null;
}

export interface GenerationLogRow {
  id: string;
  user_id: string | null;
  scene_id: string | null;
  project_id: string | null;
  step: string;
  provider: string;
  model_id: string;
  status: string;
  cost_usd: number;
  duration_ms: number | null;
  input_metadata: Record<string, unknown> | null;
  output_metadata: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

// ── Insert types (omit auto-generated fields) ──

export type SpaceInsert = Omit<SpaceRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
};

export type SceneInsert = Omit<SceneRow, "id" | "created_at" | "updated_at" | "status" | "current_step"> & {
  id?: string;
  status?: SceneStatus;
  current_step?: PipelineStep | null;
};

export type SceneInputInsert = Omit<SceneInputRow, "id" | "created_at"> & {
  id?: string;
};

export type PipelineJobInsert = Omit<PipelineJobRow, "id" | "created_at"> & {
  id?: string;
};

export type AssetInsert = Omit<AssetRow, "id" | "created_at"> & {
  id?: string;
};

export type SceneWorldInsert = Omit<SceneWorldRow, "id" | "created_at"> & {
  id?: string;
};

// ── Database type map (for Supabase client generic) ──

export interface Database {
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: Omit<UserRow, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Omit<UserRow, "id" | "created_at">>;
      };
      spaces: {
        Row: SpaceRow;
        Insert: SpaceInsert;
        Update: Partial<Omit<SpaceRow, "id" | "created_at">>;
      };
      scenes: {
        Row: SceneRow;
        Insert: SceneInsert;
        Update: Partial<Omit<SceneRow, "id" | "created_at">>;
      };
      scene_inputs: {
        Row: SceneInputRow;
        Insert: SceneInputInsert;
        Update: Partial<Omit<SceneInputRow, "id" | "created_at">>;
      };
      pipeline_jobs: {
        Row: PipelineJobRow;
        Insert: PipelineJobInsert;
        Update: Partial<Omit<PipelineJobRow, "id" | "created_at">>;
      };
      assets: {
        Row: AssetRow;
        Insert: AssetInsert;
        Update: Partial<Omit<AssetRow, "id" | "created_at">>;
      };
      scene_worlds: {
        Row: SceneWorldRow;
        Insert: SceneWorldInsert;
        Update: Partial<Omit<SceneWorldRow, "id" | "created_at">>;
      };
      generation_logs: {
        Row: GenerationLogRow;
        Insert: Omit<GenerationLogRow, "id" | "created_at"> & { id?: string };
        Update: Partial<Omit<GenerationLogRow, "id" | "created_at">>;
      };
    };
  };
}
