export type SplatResolution = "100k" | "500k" | "full_res";

export type MarbleOperationStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED";

export interface MarbleAssets {
  splat_100k?: { url: string; file_size: number };
  splat_500k?: { url: string; file_size: number };
  splat_full_res?: { url: string; file_size: number };
  collider_mesh?: { url: string; file_size: number };
  panorama?: { url: string };
  thumbnail?: { url: string };
}

export interface MarbleWorldResult {
  world_id: string;
  assets: MarbleAssets;
}

export interface MarbleOperation {
  operation_id: string;
  done: boolean;
  status: MarbleOperationStatus;
  result?: MarbleWorldResult;
  response?: MarbleWorldResult;
  error?: { message: string; code?: string | number };
  created_at: string;
  updated_at: string;
}
