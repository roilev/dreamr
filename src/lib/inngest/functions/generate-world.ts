import { inngest } from "../client";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { generateWorld, getOperation } from "@/lib/marble/client";
import { SUPABASE_BUCKETS } from "@/lib/utils/constants";
import { logGenerationStart, logGenerationComplete } from "./helpers";
import type { AssetType, AssetRow, PipelineJobRow, SceneRow, SceneWorldRow } from "@/lib/supabase/types";

async function downloadAndUpload(
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

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(storagePath);

  return { publicUrl: urlData.publicUrl, fileSize: buffer.length };
}

export const worldGeneration = inngest.createFunction(
  {
    id: "generate-world",
    retries: 2,
  },
  { event: "dreamr/world.generate" },
  async ({ event, step }) => {
    const { sceneId, userId, frameAssetId } = event.data;
    const directImageUrl = event.data.imageUrl as string | undefined;

    // ── Submit to Marble ──
    const startTime = Date.now();
    const submitResult = await step.run("submit-world-generation", async () => {
      const supabase = createAdminSupabase();

      await supabase
        .from("scenes")
        .update({ current_step: "world" } as never)
        .eq("id", sceneId);

      let imageUrl = directImageUrl;

      if (!imageUrl && frameAssetId) {
        const { data: frameAsset, error: assetError } = await supabase
          .from("assets")
          .select("public_url, storage_path")
          .eq("id", frameAssetId)
          .single() as { data: Pick<AssetRow, "public_url" | "storage_path"> | null; error: unknown };

        if (assetError || !frameAsset) {
          throw new Error("Frame asset not found");
        }

        imageUrl = frameAsset.public_url ?? undefined;
        if (!imageUrl && frameAsset.storage_path) {
          const { data: urlData } = supabase.storage
            .from(SUPABASE_BUCKETS.GENERATED_ASSETS)
            .getPublicUrl(frameAsset.storage_path);
          imageUrl = urlData.publicUrl;
        }
      }

      if (!imageUrl) {
        throw new Error("No image URL available for world generation");
      }

      const { data: scene } = await supabase
        .from("scenes")
        .select("prompt")
        .eq("id", sceneId)
        .single() as { data: Pick<SceneRow, "prompt"> | null; error: unknown };

      const { operationId } = await generateWorld(imageUrl, scene?.prompt ?? undefined, { isPano: true });
      const logId = await logGenerationStart(sceneId, "world", "marble", "marble-world-gen", userId);

      const { data: job, error: jobError } = await supabase
        .from("pipeline_jobs")
        .insert({
          scene_id: sceneId,
          step: "world",
          status: "running",
          provider: "marble",
          model_id: "marble-world-gen",
          provider_request_id: operationId,
          started_at: new Date().toISOString(),
          input_metadata: null,
          output_metadata: null,
          error_message: null,
          completed_at: null,
        } as never)
        .select()
        .single() as { data: PipelineJobRow | null; error: unknown };

      if (jobError || !job) {
        throw new Error("Failed to create pipeline job");
      }

      const { data: world, error: worldError } = await supabase
        .from("scene_worlds")
        .insert({
          scene_id: sceneId,
          marble_operation_id: operationId,
          marble_world_id: null,
          source_frame_asset_id: frameAssetId,
          status: "running",
          splat_100k_asset_id: null,
          splat_500k_asset_id: null,
          splat_full_asset_id: null,
          collider_asset_id: null,
          panorama_asset_id: null,
          completed_at: null,
        } as never)
        .select()
        .single() as { data: SceneWorldRow | null; error: unknown };

      if (worldError || !world) {
        throw new Error("Failed to create scene_world record");
      }

      return { operationId, jobId: job.id, worldId: world.id, logId };
    });

    // ── Poll Marble ──
    const MAX_POLLS = 60;
    let completed = false;
    let pollCount = 0;

    while (!completed && pollCount < MAX_POLLS) {
      await step.sleep("wait-for-world", "10s");
      pollCount++;

      const pollResult = await step.run(`poll-world-${pollCount}`, async () => {
        const op = await getOperation(submitResult.operationId);
        return { status: op.status };
      });

      if (pollResult.status === "SUCCEEDED") {
        completed = true;
      } else if (pollResult.status === "FAILED") {
        await step.run("world-failed", async () => {
          await logGenerationComplete(submitResult.logId, "failed", Date.now() - startTime, undefined, "World generation failed");
          const supabase = createAdminSupabase();
          await supabase
            .from("pipeline_jobs")
            .update({
              status: "failed",
              completed_at: new Date().toISOString(),
              error_message: "World generation failed",
            } as never)
            .eq("id", submitResult.jobId);
          await supabase
            .from("scene_worlds")
            .update({ status: "failed" } as never)
            .eq("id", submitResult.worldId);
          await supabase
            .from("scenes")
            .update({ status: "failed", current_step: null } as never)
            .eq("id", sceneId);
        });
        throw new Error("World generation failed");
      }
    }

    if (!completed) {
      await step.run("world-timeout", async () => {
        await logGenerationComplete(submitResult.logId, "failed", Date.now() - startTime, undefined, "World generation timed out");
        const supabase = createAdminSupabase();
        await supabase
          .from("pipeline_jobs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: "World generation timed out",
          } as never)
          .eq("id", submitResult.jobId);
        await supabase
          .from("scene_worlds")
          .update({ status: "failed" } as never)
          .eq("id", submitResult.worldId);
      });
      throw new Error("World generation timed out");
    }

    // ── Download and store all Marble assets ──
    await step.run("store-world-assets", async () => {
      const supabase = createAdminSupabase();
      const op = await getOperation(submitResult.operationId);
      const assets = op.result?.assets;

      if (!assets) {
        throw new Error("No assets in Marble result");
      }

      const worldUpdates: Record<string, string | null> = {
        marble_world_id: op.result?.world_id ?? null,
      };

      const assetEntries: Array<{
        key: string;
        type: AssetType;
        url: string;
        fileSize?: number;
        storageName: string;
        worldField: string;
      }> = [];

      if (assets.splat_100k) {
        assetEntries.push({
          key: "splat_100k",
          type: "splat_100k",
          url: assets.splat_100k.url,
          fileSize: assets.splat_100k.file_size,
          storageName: "splat_100k.ply",
          worldField: "splat_100k_asset_id",
        });
      }
      if (assets.splat_500k) {
        assetEntries.push({
          key: "splat_500k",
          type: "splat_500k",
          url: assets.splat_500k.url,
          fileSize: assets.splat_500k.file_size,
          storageName: "splat_500k.ply",
          worldField: "splat_500k_asset_id",
        });
      }
      if (assets.splat_full_res) {
        assetEntries.push({
          key: "splat_full",
          type: "splat_full",
          url: assets.splat_full_res.url,
          fileSize: assets.splat_full_res.file_size,
          storageName: "splat_full.ply",
          worldField: "splat_full_asset_id",
        });
      }
      if (assets.collider_mesh) {
        assetEntries.push({
          key: "collider",
          type: "collider_mesh",
          url: assets.collider_mesh.url,
          fileSize: assets.collider_mesh.file_size,
          storageName: "collider.glb",
          worldField: "collider_asset_id",
        });
      }
      if (assets.panorama) {
        assetEntries.push({
          key: "panorama",
          type: "panorama",
          url: assets.panorama.url,
          storageName: "panorama.png",
          worldField: "panorama_asset_id",
        });
      }

      for (const entry of assetEntries) {
        const storagePath = `${userId}/${sceneId}/world/${submitResult.jobId}/${entry.storageName}`;
        const { publicUrl, fileSize } = await downloadAndUpload(
          entry.url,
          SUPABASE_BUCKETS.GENERATED_ASSETS,
          storagePath,
        );

        const { data: assetRecord, error: assetError } = await supabase
          .from("assets")
          .insert({
            scene_id: sceneId,
            job_id: submitResult.jobId,
            type: entry.type,
            storage_path: storagePath,
            public_url: publicUrl,
            file_size_bytes: entry.fileSize ?? fileSize,
            width: null,
            height: null,
            duration_seconds: null,
            metadata: null,
          } as never)
          .select()
          .single() as { data: AssetRow | null; error: unknown };

        if (assetError || !assetRecord) {
          throw new Error(`Failed to create asset for ${entry.key}`);
        }

        worldUpdates[entry.worldField] = assetRecord.id;
      }

      await supabase
        .from("scene_worlds")
        .update({
          ...worldUpdates,
          status: "completed",
          completed_at: new Date().toISOString(),
        } as never)
        .eq("id", submitResult.worldId);

      await logGenerationComplete(submitResult.logId, "completed", Date.now() - startTime);

      await supabase
        .from("pipeline_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        } as never)
        .eq("id", submitResult.jobId);

      await supabase
        .from("scenes")
        .update({ current_step: null } as never)
        .eq("id", sceneId);
    });

    return { success: true, sceneId };
  },
);
