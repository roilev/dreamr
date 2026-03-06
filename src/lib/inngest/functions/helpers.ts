import { createAdminSupabase } from "@/lib/supabase/admin";
import { estimateCost } from "@/lib/utils/costs";
import type { AssetType, PipelineStep, AssetRow, PipelineJobRow } from "@/lib/supabase/types";

export async function downloadAndUpload(
  url: string,
  bucket: string,
  storagePath: string,
): Promise<{ publicUrl: string; fileSize: number }> {
  const response = await fetch(url);
  const buffer = Buffer.from(await response.arrayBuffer());

  const supabase = createAdminSupabase();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, {
      upsert: true,
      contentType: response.headers.get("content-type") || "application/octet-stream",
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return { publicUrl: urlData.publicUrl, fileSize: buffer.length };
}

export async function createJob(
  sceneId: string,
  step: PipelineStep,
  provider: string,
  modelId: string,
  inputMetadata?: Record<string, unknown>,
) {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("pipeline_jobs")
    .insert({
      scene_id: sceneId,
      step,
      status: "running",
      provider,
      model_id: modelId,
      started_at: new Date().toISOString(),
      provider_request_id: null,
      input_metadata: inputMetadata ?? null,
      output_metadata: null,
      error_message: null,
      completed_at: null,
    } as never)
    .select()
    .single() as { data: PipelineJobRow | null; error: unknown };

  if (error || !data) throw new Error("Failed to create job");
  return data;
}

export async function completeJob(jobId: string, outputMetadata?: Record<string, unknown>) {
  const supabase = createAdminSupabase();
  await supabase
    .from("pipeline_jobs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      output_metadata: outputMetadata ?? null,
    } as never)
    .eq("id", jobId);
}

export async function failJob(jobId: string, errorMessage: string) {
  const supabase = createAdminSupabase();
  await supabase
    .from("pipeline_jobs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
    } as never)
    .eq("id", jobId);
}

export async function createAsset(
  sceneId: string,
  jobId: string,
  type: AssetType,
  storagePath: string,
  publicUrl: string,
  opts?: { fileSize?: number; width?: number; height?: number; durationSeconds?: number },
) {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("assets")
    .insert({
      scene_id: sceneId,
      job_id: jobId,
      type,
      storage_path: storagePath,
      public_url: publicUrl,
      file_size_bytes: opts?.fileSize ?? null,
      width: opts?.width ?? null,
      height: opts?.height ?? null,
      duration_seconds: opts?.durationSeconds ?? null,
      metadata: null,
    } as never)
    .select()
    .single() as { data: AssetRow | null; error: unknown };

  if (error || !data) throw new Error("Failed to create asset");
  return data;
}

export async function updateScene(sceneId: string, updates: Record<string, unknown>) {
  const supabase = createAdminSupabase();
  await supabase.from("scenes").update(updates as never).eq("id", sceneId);
}

export async function findAsset(sceneId: string, type: string): Promise<AssetRow | null> {
  const supabase = createAdminSupabase();
  const { data } = await supabase
    .from("assets")
    .select("*")
    .eq("scene_id", sceneId)
    .eq("type", type)
    .order("created_at", { ascending: false })
    .limit(1)
    .single() as { data: AssetRow | null };
  return data;
}

export async function logGenerationStart(
  sceneId: string,
  step: string,
  provider: string,
  modelId: string,
  userId?: string,
): Promise<string> {
  const supabase = createAdminSupabase();

  const { data: scene } = await supabase
    .from("scenes")
    .select("space_id")
    .eq("id", sceneId)
    .single();

  const { data, error } = await supabase
    .from("generation_logs")
    .insert({
      user_id: userId ?? null,
      scene_id: sceneId,
      space_id: (scene as any)?.space_id ?? null,
      step,
      provider,
      model_id: modelId,
      status: "started",
      cost_usd: estimateCost(modelId),
    } as never)
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to log generation:", error);
    return "";
  }
  return (data as { id: string }).id;
}

export async function downloadAndUploadBuffer(
  buffer: Buffer,
  bucket: string,
  storagePath: string,
): Promise<{ publicUrl: string; fileSize: number }> {
  const supabase = createAdminSupabase();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, {
      upsert: true,
      contentType: "image/png",
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return { publicUrl: urlData.publicUrl, fileSize: buffer.length };
}

export async function logGenerationComplete(
  logId: string,
  status: "completed" | "failed",
  durationMs?: number,
  outputMetadata?: Record<string, unknown>,
  errorMessage?: string,
) {
  if (!logId) return;
  const supabase = createAdminSupabase();
  await supabase
    .from("generation_logs")
    .update({
      status,
      duration_ms: durationMs ?? null,
      completed_at: new Date().toISOString(),
      output_metadata: outputMetadata ?? null,
      error_message: errorMessage ?? null,
    } as never)
    .eq("id", logId);
}
