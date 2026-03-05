import { inngest } from "../client";
import { estimateDepth } from "@/lib/fal/depth";
import { SUPABASE_BUCKETS, FAL_MODELS } from "@/lib/utils/constants";
import { downloadAndUpload, createJob, completeJob, failJob, createAsset, updateScene, findAsset, logGenerationStart, logGenerationComplete } from "./helpers";
import type { DepthModel } from "@/lib/fal/types";

export const stepDepth = inngest.createFunction(
  { id: "step-depth", retries: 2 },
  { event: "dreamr/step.depth" },
  async ({ event, step }) => {
    const { sceneId, userId } = event.data;
    const inputImageUrl = event.data.imageUrl as string | undefined;

    await step.run("estimate-depth", async () => {
      let imageUrl = inputImageUrl;
      if (!imageUrl) {
        const equirect = await findAsset(sceneId, "equirect_image");
        if (!equirect?.public_url) throw new Error("No equirect image found — generate a 360° image first");
        imageUrl = equirect.public_url;
      }

      await updateScene(sceneId, { status: "generating", current_step: "depth" });
      const depthModelId = event.data.depthModel ?? FAL_MODELS.DEPTH_ANYTHING_V2;
      const job = await createJob(sceneId, "depth", "fal", depthModelId);

      const startTime = Date.now();
      const logId = await logGenerationStart(sceneId, "depth", "fal", depthModelId, userId);
      try {
        const result = await estimateDepth(imageUrl!, {
          model: depthModelId as DepthModel,
        });

        const depthUrl = result.image.url;
        const storagePath = `${userId}/${sceneId}/depth_${job.id}.png`;
        const { publicUrl, fileSize } = await downloadAndUpload(
          depthUrl,
          SUPABASE_BUCKETS.GENERATED_ASSETS,
          storagePath,
        );

        await createAsset(sceneId, job.id, "depth_map", storagePath, publicUrl, {
          fileSize,
          width: result.image.width,
          height: result.image.height,
        });

        await logGenerationComplete(logId, "completed", Date.now() - startTime);
        await completeJob(job.id);
        await updateScene(sceneId, { status: "completed", current_step: null });
      } catch (err) {
        await logGenerationComplete(logId, "failed", Date.now() - startTime, undefined, err instanceof Error ? err.message : "Unknown error");
        await failJob(job.id, err instanceof Error ? err.message : "Unknown error");
        await updateScene(sceneId, { status: "failed", current_step: null });
        throw err;
      }
    });

    return { success: true };
  },
);
