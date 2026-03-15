import { inngest } from "../client";
import { upscaleImage } from "@/lib/fal/seedvr-image";
import { estimateDepth } from "@/lib/fal/depth";
import { SUPABASE_BUCKETS, FAL_MODELS } from "@/lib/utils/constants";
import {
  downloadAndUpload,
  createJob,
  completeJob,
  failJob,
  createAsset,
  updateScene,
  findAssetById,
  logGenerationStart,
  logGenerationComplete,
} from "./helpers";

export const stepEnhance = inngest.createFunction(
  { id: "step-enhance", retries: 2 },
  { event: "dreamr/step.enhance" },
  async ({ event, step }) => {
    const { sceneId, userId, sourceAssetId, runUpscale, runDepth } = event.data;

    await step.run("enhance", async () => {
      const sourceAsset = await findAssetById(sourceAssetId);
      if (!sourceAsset?.public_url) {
        throw new Error("Source asset not found or has no URL");
      }

      const imageUrl = sourceAsset.public_url;
      const enhancedMeta = { enhanced_from: sourceAssetId };

      await updateScene(sceneId, { status: "generating", current_step: "enhance" });

      const providers: string[] = [];
      if (runUpscale) providers.push("fal/seedvr-upscale-image");
      if (runDepth) providers.push("fal/depth-anything-v2");
      const providerLabel = providers.join(" + ");
      const modelLabel = [
        runUpscale ? FAL_MODELS.SEEDVR_UPSCALE_IMAGE : null,
        runDepth ? FAL_MODELS.DEPTH_ANYTHING_V2 : null,
      ].filter(Boolean).join(" + ");

      const job = await createJob(sceneId, "enhance", "fal", modelLabel);
      const startTime = Date.now();
      const logId = await logGenerationStart(sceneId, "enhance", "fal", modelLabel, userId);

      try {
        const tasks: Promise<void>[] = [];

        let upscaledUrl: string | null = null;

        if (runUpscale) {
          tasks.push(
            (async () => {
              const result = await upscaleImage(imageUrl);
              const storagePath = `${userId}/${sceneId}/enhanced_upscale_${job.id}.png`;
              const { publicUrl, fileSize } = await downloadAndUpload(
                result.imageUrl,
                SUPABASE_BUCKETS.GENERATED_ASSETS,
                storagePath,
              );
              upscaledUrl = publicUrl;

              await createAsset(sceneId, job.id, "equirect_image", storagePath, publicUrl, {
                fileSize,
                metadata: enhancedMeta,
              });
            })(),
          );
        }

        if (runDepth) {
          tasks.push(
            (async () => {
              const result = await estimateDepth(imageUrl);
              const depthUrl = result.image.url;
              const storagePath = `${userId}/${sceneId}/enhanced_depth_${job.id}.png`;
              const { publicUrl, fileSize } = await downloadAndUpload(
                depthUrl,
                SUPABASE_BUCKETS.GENERATED_ASSETS,
                storagePath,
              );

              await createAsset(sceneId, job.id, "depth_map", storagePath, publicUrl, {
                fileSize,
                width: result.image.width,
                height: result.image.height,
                metadata: enhancedMeta,
              });
            })(),
          );
        }

        await Promise.all(tasks);

        // If depth-only (no upscale), still create a new equirect_image entry
        // pointing to the original URL so "V{n} Enhanced" appears in the dropdown
        if (!runUpscale && runDepth) {
          await createAsset(
            sceneId,
            job.id,
            "equirect_image",
            sourceAsset.storage_path ?? "",
            imageUrl,
            { metadata: enhancedMeta },
          );
        }

        await logGenerationComplete(logId, "completed", Date.now() - startTime, {
          source_asset_id: sourceAssetId,
          run_upscale: runUpscale,
          run_depth: runDepth,
          upscaled_url: upscaledUrl,
        });
        await completeJob(job.id, {
          source_asset_id: sourceAssetId,
          run_upscale: runUpscale,
          run_depth: runDepth,
        });
        await updateScene(sceneId, { status: "completed", current_step: null });
      } catch (err) {
        await logGenerationComplete(
          logId,
          "failed",
          Date.now() - startTime,
          undefined,
          err instanceof Error ? err.message : "Unknown error",
        );
        await failJob(job.id, err instanceof Error ? err.message : "Unknown error");
        await updateScene(sceneId, { status: "failed", current_step: null });
        throw err;
      }
    });

    return { success: true };
  },
);
