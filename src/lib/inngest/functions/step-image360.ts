import { inngest } from "../client";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { generateImage, editImage, inpaintSeam, fillPoleCapture } from "@/lib/fal/nano-banana";
import { SUPABASE_BUCKETS, FAL_MODELS } from "@/lib/utils/constants";
import {
  downloadAndUploadBuffer,
  createJob,
  completeJob,
  failJob,
  createAsset,
  updateScene,
  logGenerationStart,
  logGenerationComplete,
} from "./helpers";
import {
  prepareSeamCrop,
  applySeamFix,
  letterboxAndRenderPoles,
  reprojectFilledPoles,
  wrapAndRenderCaptures,
  reprojectFilledCaptures,
  resizeToEquirect,
} from "@/lib/processing/equirect-processing";
import {
  getTextOnlyPrompt,
  getRefImagePrompt,
  getMultiImagePrompt,
  SEAM_FIX_PROMPT,
  POLE_FILL_PROMPT,
  WORKFLOW_CONFIGS,
  type WorkflowType,
  type PromptMode,
} from "@/lib/processing/prompts";
import type { SceneRow, SceneInputRow } from "@/lib/supabase/types";

export const stepImage360 = inngest.createFunction(
  { id: "step-image360", retries: 1 },
  { event: "dreamr/step.image360" },
  async ({ event, step }) => {
    const { sceneId, userId } = event.data;
    const workflow = ((event.data as Record<string, unknown>).workflow as WorkflowType) || "equirect";
    const promptMode = ((event.data as Record<string, unknown>).promptMode as PromptMode) || "precise";
    const config = WORKFLOW_CONFIGS[workflow];

    const startTime = Date.now();
    await updateScene(sceneId, { status: "generating", current_step: "image_360" });

    const supabase = createAdminSupabase();
    const { data: scene } = await supabase
      .from("scenes")
      .select("prompt")
      .eq("id", sceneId)
      .single() as { data: Pick<SceneRow, "prompt"> | null; error: unknown };

    const { data: inputs } = await supabase
      .from("scene_inputs")
      .select("*")
      .eq("scene_id", sceneId)
      .eq("type", "image")
      .order("sort_order") as { data: SceneInputRow[] | null; error: unknown };

    const referenceUrls: string[] = [];
    const inputSlots: { index: number; slot: string }[] = [];
    if (inputs?.length) {
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        if (input.storage_path) {
          const { data: urlData } = supabase.storage
            .from(SUPABASE_BUCKETS.SCENE_INPUTS)
            .getPublicUrl(input.storage_path);
          referenceUrls.push(urlData.publicUrl);
          inputSlots.push({
            index: i,
            slot: (input as Record<string, unknown>).slot as string || "front",
          });
        }
      }
    }

    const hasImages = referenceUrls.length > 0;
    const modelId = hasImages ? FAL_MODELS.NANO_BANANA_2_EDIT : FAL_MODELS.NANO_BANANA_2;
    const userPrompt = scene?.prompt || "";

    const job = await createJob(sceneId, "image_360", "fal", modelId, {
      workflow,
      prompt_mode: promptMode,
      user_prompt: userPrompt || null,
      has_reference_images: hasImages,
      reference_image_count: referenceUrls.length,
    });
    const logId = await logGenerationStart(sceneId, "image_360", "fal", modelId, userId);
    const basePath = `${userId}/${sceneId}`;
    const intermediates: Record<string, string> = {};

    try {
      // ── Step 1: Generate ──
      let generatePrompt: string;
      if (!hasImages) {
        generatePrompt = getTextOnlyPrompt(workflow, promptMode, userPrompt || "A beautiful panoramic landscape");
      } else if (referenceUrls.length === 1) {
        generatePrompt = getRefImagePrompt(workflow, promptMode, userPrompt || undefined);
      } else {
        generatePrompt = getMultiImagePrompt(workflow, promptMode, inputSlots, userPrompt || undefined);
      }

      const genResult = hasImages
        ? await editImage({
            prompt: generatePrompt,
            imageUrls: referenceUrls,
            aspectRatio: config.generateAspectRatio as "21:9" | "4:1",
          })
        : await generateImage({
            prompt: generatePrompt,
            aspectRatio: config.generateAspectRatio as "21:9" | "4:1",
          });

      const rawImage = genResult.images[0];
      const rawResponse = await fetch(rawImage.url);
      const rawBuffer = Buffer.from(await rawResponse.arrayBuffer());

      const rawPath = `${basePath}/raw_${job.id}.png`;
      const { publicUrl: rawUrl } = await downloadAndUploadBuffer(
        rawBuffer, SUPABASE_BUCKETS.GENERATED_ASSETS, rawPath,
      );
      intermediates.raw = rawUrl;

      await updateJobMeta(job.id, {
        step_1_generate: {
          prompt: generatePrompt,
          raw_url: rawUrl,
          dimensions: { width: rawImage.width, height: rawImage.height },
        },
      });

      // ── Step 2: Seam Fix ──
      const { seamCropBuffer, shiftedPixels, sourceWidth, sourceHeight } =
        await prepareSeamCrop(rawBuffer, config.defaults.stripWidth);

      const seamCropPath = `${basePath}/seam-crop_${job.id}.png`;
      const { publicUrl: seamCropUrl } = await downloadAndUploadBuffer(
        seamCropBuffer, SUPABASE_BUCKETS.GENERATED_ASSETS, seamCropPath,
      );
      intermediates.seamCrop = seamCropUrl;

      const seamResult = await inpaintSeam(seamCropUrl, SEAM_FIX_PROMPT);
      const seamInpaintedUrl = seamResult.images[0].url;
      const seamResponse = await fetch(seamInpaintedUrl);
      const seamInpaintedBuffer = Buffer.from(await seamResponse.arrayBuffer());

      const seamFixedBuffer = await applySeamFix(
        shiftedPixels, sourceWidth, sourceHeight,
        seamInpaintedBuffer, config.defaults.stripWidth,
      );
      const seamFixedPath = `${basePath}/seam-fixed_${job.id}.png`;
      const { publicUrl: seamFixedUrl } = await downloadAndUploadBuffer(
        seamFixedBuffer, SUPABASE_BUCKETS.GENERATED_ASSETS, seamFixedPath,
      );
      intermediates.seamFixed = seamFixedUrl;

      await updateJobMeta(job.id, {
        step_2_seam: {
          prompt: SEAM_FIX_PROMPT,
          crop_url: seamCropUrl,
          inpainted_url: seamInpaintedUrl,
          fixed_url: seamFixedUrl,
        },
      });

      // ── Step 3: Pole Fill ──
      let poleTopUrl: string;
      let poleBottomUrl: string;
      let intermediateEqBuffer: Buffer;

      if (workflow === "equirect") {
        const { letterboxedBuffer, poleTopBuffer, poleBottomBuffer, eqWidth, eqHeight } =
          await letterboxAndRenderPoles(seamFixedBuffer, config.defaults.poleFov);

        const lbPath = `${basePath}/letterboxed_${job.id}.png`;
        const { publicUrl: lbUrl } = await downloadAndUploadBuffer(
          letterboxedBuffer, SUPABASE_BUCKETS.GENERATED_ASSETS, lbPath,
        );
        intermediates.letterboxed = lbUrl;
        intermediateEqBuffer = letterboxedBuffer;

        const topPath = `${basePath}/pole-top_${job.id}.png`;
        const botPath = `${basePath}/pole-bot_${job.id}.png`;
        const { publicUrl: topCaptureUrl } = await downloadAndUploadBuffer(
          poleTopBuffer, SUPABASE_BUCKETS.GENERATED_ASSETS, topPath,
        );
        const { publicUrl: botCaptureUrl } = await downloadAndUploadBuffer(
          poleBottomBuffer, SUPABASE_BUCKETS.GENERATED_ASSETS, botPath,
        );
        intermediates.poleTop = topCaptureUrl;
        intermediates.poleBottom = botCaptureUrl;

        const [topFill, botFill] = await Promise.all([
          fillPoleCapture(topCaptureUrl, POLE_FILL_PROMPT),
          fillPoleCapture(botCaptureUrl, POLE_FILL_PROMPT),
        ]);

        poleTopUrl = topFill.images[0].url;
        poleBottomUrl = botFill.images[0].url;
      } else {
        const vCov = config.defaults.vertCoverage ?? 75;
        const cFov = config.defaults.captureFov ?? 120;
        const cYaw = config.defaults.captureYaw ?? -15;

        const { wrappedBuffer, captureTopBuffer, captureBottomBuffer } =
          await wrapAndRenderCaptures(seamFixedBuffer, vCov, cFov, cYaw);

        const wrappedPath = `${basePath}/wrapped_${job.id}.png`;
        const { publicUrl: wrappedUrl } = await downloadAndUploadBuffer(
          wrappedBuffer, SUPABASE_BUCKETS.GENERATED_ASSETS, wrappedPath,
        );
        intermediates.wrapped = wrappedUrl;
        intermediateEqBuffer = wrappedBuffer;

        const topPath = `${basePath}/cap-top_${job.id}.png`;
        const botPath = `${basePath}/cap-bot_${job.id}.png`;
        const { publicUrl: topCaptureUrl } = await downloadAndUploadBuffer(
          captureTopBuffer, SUPABASE_BUCKETS.GENERATED_ASSETS, topPath,
        );
        const { publicUrl: botCaptureUrl } = await downloadAndUploadBuffer(
          captureBottomBuffer, SUPABASE_BUCKETS.GENERATED_ASSETS, botPath,
        );
        intermediates.captureTop = topCaptureUrl;
        intermediates.captureBottom = botCaptureUrl;

        const [topFill, botFill] = await Promise.all([
          fillPoleCapture(topCaptureUrl, POLE_FILL_PROMPT),
          fillPoleCapture(botCaptureUrl, POLE_FILL_PROMPT),
        ]);

        poleTopUrl = topFill.images[0].url;
        poleBottomUrl = botFill.images[0].url;
      }

      const [topFillResp, botFillResp] = await Promise.all([
        fetch(poleTopUrl),
        fetch(poleBottomUrl),
      ]);
      const filledTopBuffer = Buffer.from(await topFillResp.arrayBuffer());
      const filledBottomBuffer = Buffer.from(await botFillResp.arrayBuffer());

      await updateJobMeta(job.id, {
        step_3_poles: {
          prompt: POLE_FILL_PROMPT,
          filled_top_url: poleTopUrl,
          filled_bottom_url: poleBottomUrl,
          intermediates,
        },
      });

      // ── Step 4: Finalize ──
      let finalBuffer: Buffer;
      if (workflow === "equirect") {
        finalBuffer = await reprojectFilledPoles(
          intermediateEqBuffer!, filledTopBuffer, filledBottomBuffer,
          config.defaults.poleFov, config.defaults.featherDeg,
        );
      } else {
        finalBuffer = await reprojectFilledCaptures(
          intermediateEqBuffer!, filledTopBuffer, filledBottomBuffer,
          config.defaults.captureFov ?? 120, config.defaults.captureYaw ?? -15,
        );
      }

      const storagePath = `${basePath}/equirect_${job.id}.png`;
      const adminSb = createAdminSupabase();
      const { error: uploadError } = await adminSb.storage
        .from(SUPABASE_BUCKETS.GENERATED_ASSETS)
        .upload(storagePath, finalBuffer, { upsert: true, contentType: "image/png" });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const { data: urlData } = adminSb.storage
        .from(SUPABASE_BUCKETS.GENERATED_ASSETS)
        .getPublicUrl(storagePath);

      await createAsset(sceneId, job.id, "equirect_image", storagePath, urlData.publicUrl, {
        fileSize: finalBuffer.length,
        width: 4096,
        height: 2048,
      });

      await completeJob(job.id, {
        workflow,
        prompt_mode: promptMode,
        intermediates,
        description: genResult.description,
      });
      await logGenerationComplete(logId, "completed", Date.now() - startTime, {
        workflow,
        description: genResult.description,
      });
      await updateScene(sceneId, { status: "completed", current_step: null });
      return { success: true };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      await failJob(job.id, errMsg);
      await logGenerationComplete(logId, "failed", Date.now() - startTime, undefined, errMsg);
      await updateScene(sceneId, { status: "failed", current_step: null });
      throw err;
    }
  },
);

async function updateJobMeta(jobId: string, stepData: Record<string, unknown>) {
  const supabase = createAdminSupabase();
  const { data: current } = await supabase
    .from("pipeline_jobs")
    .select("output_metadata")
    .eq("id", jobId)
    .single();

  const existing = ((current as Record<string, unknown> | null)?.output_metadata as Record<string, unknown>) || {};
  await supabase
    .from("pipeline_jobs")
    .update({ output_metadata: { ...existing, ...stepData } } as never)
    .eq("id", jobId);
}
