import { inngest } from "../client";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { upscaleVideo } from "@/lib/fal/seedvr";
import { fal } from "@/lib/fal/client";
import { SUPABASE_BUCKETS, FAL_MODELS } from "@/lib/utils/constants";
import { downloadAndUpload, createJob, completeJob, failJob, createAsset, updateScene, findAsset, logGenerationStart, logGenerationComplete } from "./helpers";
import type { SeedVROutput } from "@/lib/fal/types";

export const stepUpscale = inngest.createFunction(
  { id: "step-upscale", retries: 2 },
  { event: "dreamr/step.upscale" },
  async ({ event, step }) => {
    const { sceneId, userId } = event.data;

    const startTime = Date.now();
    const submitResult = await step.run("submit-upscale", async () => {
      const video = await findAsset(sceneId, "video");
      if (!video?.public_url) throw new Error("No video found — generate a video first");

      await updateScene(sceneId, { status: "generating", current_step: "upscale" });
      const job = await createJob(sceneId, "upscale", "fal", FAL_MODELS.SEEDVR_UPSCALE);
      const logId = await logGenerationStart(sceneId, "upscale", "fal", FAL_MODELS.SEEDVR_UPSCALE, userId);

      try {
        const { requestId } = await upscaleVideo(video.public_url);

        const supabase = createAdminSupabase();
        await supabase
          .from("pipeline_jobs")
          .update({ provider_request_id: requestId } as never)
          .eq("id", job.id);

        return { jobId: job.id, requestId, logId };
      } catch (err) {
        await logGenerationComplete(logId, "failed", Date.now() - startTime, undefined, err instanceof Error ? err.message : "Unknown error");
        await failJob(job.id, err instanceof Error ? err.message : "Unknown error");
        await updateScene(sceneId, { status: "failed", current_step: null });
        throw err;
      }
    });

    const MAX_POLLS = 60;
    let completed = false;
    let pollCount = 0;

    while (!completed && pollCount < MAX_POLLS) {
      await step.sleep("wait-for-upscale", "15s");
      pollCount++;

      const pollResult = await step.run(`poll-upscale-${pollCount}`, async () => {
        const status = await fal.queue.status(FAL_MODELS.SEEDVR_UPSCALE, {
          requestId: submitResult.requestId,
          logs: true,
        });
        return { status: status.status as string };
      });

      if (pollResult.status === "COMPLETED") completed = true;
      else if (pollResult.status === "FAILED") {
        await step.run("upscale-failed", async () => {
          await logGenerationComplete(submitResult.logId, "failed", Date.now() - startTime, undefined, "Upscale failed");
          await failJob(submitResult.jobId, "Upscale failed");
          await updateScene(sceneId, { status: "failed", current_step: null });
        });
        throw new Error("Upscale failed");
      }
    }

    if (!completed) {
      await step.run("upscale-timeout", async () => {
        await logGenerationComplete(submitResult.logId, "failed", Date.now() - startTime, undefined, "Upscale timed out");
        await failJob(submitResult.jobId, "Upscale timed out");
        await updateScene(sceneId, { status: "failed", current_step: null });
      });
      throw new Error("Upscale timed out");
    }

    await step.run("download-upscaled", async () => {
      const result = await fal.queue.result(FAL_MODELS.SEEDVR_UPSCALE, {
        requestId: submitResult.requestId,
      });
      const output = result.data as unknown as SeedVROutput;
      const videoUrl = output.video.url;
      const storagePath = `${userId}/${sceneId}/video_upscaled_${submitResult.jobId}.mp4`;
      const { publicUrl, fileSize } = await downloadAndUpload(
        videoUrl,
        SUPABASE_BUCKETS.GENERATED_ASSETS,
        storagePath,
      );

      await createAsset(sceneId, submitResult.jobId, "upscaled_video", storagePath, publicUrl, { fileSize });
      await logGenerationComplete(submitResult.logId, "completed", Date.now() - startTime);
      await completeJob(submitResult.jobId);
      await updateScene(sceneId, { status: "completed", current_step: null });
    });

    return { success: true };
  },
);
