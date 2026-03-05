import { inngest } from "../client";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { generateVideo, checkVideoStatus, getVideoResult } from "@/lib/fal/veo";
import { SUPABASE_BUCKETS, FAL_MODELS } from "@/lib/utils/constants";
import { downloadAndUpload, createJob, completeJob, failJob, createAsset, updateScene, findAsset, logGenerationStart, logGenerationComplete } from "./helpers";
import type { VeoModel } from "@/lib/fal/types";
import type { SceneRow } from "@/lib/supabase/types";

export const stepVideo = inngest.createFunction(
  { id: "step-video", retries: 2, concurrency: { limit: 5 } },
  { event: "dreamr/step.video" },
  async ({ event, step }) => {
    const { sceneId, userId } = event.data;
    const veoModel: VeoModel = (event.data.veoModel as VeoModel) ?? "fal-ai/veo3.1/image-to-video";

    const startTime = Date.now();
    const submitResult = await step.run("submit-video", async () => {
      const equirect = await findAsset(sceneId, "equirect_image");
      if (!equirect?.public_url) throw new Error("No equirect image found — generate a 360° image first");

      await updateScene(sceneId, { status: "generating", current_step: "video" });
      const job = await createJob(sceneId, "video", "fal", veoModel);
      const logId = await logGenerationStart(sceneId, "video", "fal", veoModel, userId);

      const supabase = createAdminSupabase();
      const { data: scene } = await supabase
        .from("scenes")
        .select("prompt")
        .eq("id", sceneId)
        .single() as { data: Pick<SceneRow, "prompt"> | null; error: unknown };

      const animationPrompt = scene?.prompt || "Gentle camera movement through the scene";

      try {
        const { requestId } = await generateVideo(equirect.public_url, animationPrompt, { model: veoModel });

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
      await step.sleep("wait-for-video", "15s");
      pollCount++;

      const pollResult = await step.run(`poll-video-${pollCount}`, async () => {
        const status = await checkVideoStatus(submitResult.requestId, veoModel);
        return { status: status.status as string };
      });

      if (pollResult.status === "COMPLETED") {
        completed = true;
      } else if (pollResult.status === "FAILED") {
        await step.run("video-failed", async () => {
          await logGenerationComplete(submitResult.logId, "failed", Date.now() - startTime, undefined, "Video generation failed");
          await failJob(submitResult.jobId, "Video generation failed");
          await updateScene(sceneId, { status: "failed", current_step: null });
        });
        throw new Error("Video generation failed");
      }
    }

    if (!completed) {
      await step.run("video-timeout", async () => {
        await logGenerationComplete(submitResult.logId, "failed", Date.now() - startTime, undefined, "Video generation timed out");
        await failJob(submitResult.jobId, "Video generation timed out");
        await updateScene(sceneId, { status: "failed", current_step: null });
      });
      throw new Error("Video generation timed out");
    }

    await step.run("download-video", async () => {
      const result = await getVideoResult(submitResult.requestId, veoModel);
      const videoUrl = result.video.url;
      const storagePath = `${userId}/${sceneId}/video_${submitResult.jobId}.mp4`;
      const { publicUrl, fileSize } = await downloadAndUpload(
        videoUrl,
        SUPABASE_BUCKETS.GENERATED_ASSETS,
        storagePath,
      );

      await createAsset(sceneId, submitResult.jobId, "video", storagePath, publicUrl, { fileSize });
      const outputMeta = {
        ...(result.video.file_name != null && { file_name: result.video.file_name }),
        ...(result.video.file_size != null && { file_size: result.video.file_size }),
      };
      await logGenerationComplete(submitResult.logId, "completed", Date.now() - startTime, outputMeta);
      await completeJob(submitResult.jobId, outputMeta);
      await updateScene(sceneId, { status: "completed", current_step: null });
    });

    return { success: true };
  },
);
