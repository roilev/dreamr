import { inngest } from "../client";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { generate360Image, edit360Image, EQUIRECT_TEXT_PROMPT, EQUIRECT_SINGLE_IMAGE_PROMPT, EQUIRECT_COMPOSITE_PROMPT } from "@/lib/fal/nano-banana";
import { SUPABASE_BUCKETS, FAL_MODELS } from "@/lib/utils/constants";
import { downloadAndUploadBuffer, createJob, completeJob, failJob, createAsset, updateScene, logGenerationStart, logGenerationComplete } from "./helpers";
import { compositeEquirect, resizeToEquirect } from "@/lib/utils/equirect-composite";
import type { SceneRow, SceneInputRow } from "@/lib/supabase/types";

export const stepImage360 = inngest.createFunction(
  { id: "step-image360", retries: 2 },
  { event: "dreamr/step.image360" },
  async ({ event, step }) => {
    const { sceneId, userId } = event.data;

    return await step.run("generate-360-image", async () => {
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
      if (inputs?.length) {
        for (const input of inputs) {
          if (input.storage_path) {
            const { data: urlData } = supabase.storage
              .from(SUPABASE_BUCKETS.SCENE_INPUTS)
              .getPublicUrl(input.storage_path);
            referenceUrls.push(urlData.publicUrl);
          }
        }
      }

      const hasImages = referenceUrls.length > 0;
      const modelId = hasImages ? FAL_MODELS.NANO_BANANA_2_EDIT : FAL_MODELS.NANO_BANANA_2;
      const prompt = scene?.prompt || "";

      let fullPrompt: string;
      if (hasImages && inputs?.length) {
        const prefix = inputs.length > 1 ? EQUIRECT_COMPOSITE_PROMPT : EQUIRECT_SINGLE_IMAGE_PROMPT;
        fullPrompt = prompt ? `${prefix}${prompt}` : prefix.trim();
      } else {
        const textPrompt = prompt || "A beautiful panoramic landscape";
        fullPrompt = `${EQUIRECT_TEXT_PROMPT}${textPrompt}`;
      }

      const job = await createJob(sceneId, "image_360", "fal", modelId, {
        prompt: fullPrompt,
        user_prompt: prompt || null,
        has_reference_images: hasImages,
        reference_image_count: referenceUrls.length,
      });
      const logId = await logGenerationStart(sceneId, "image_360", "fal", modelId, userId);

      try {
        let result;

        if (hasImages && inputs?.length) {
          const positionedInputs = await Promise.all(
            inputs.map(async (input) => {
              const url = supabase.storage.from(SUPABASE_BUCKETS.SCENE_INPUTS).getPublicUrl(input.storage_path!).data.publicUrl;
              const response = await fetch(url);
              const buffer = Buffer.from(await response.arrayBuffer());
              const size = input.position_z || 0;
              return {
                imageBuffer: buffer,
                longitude: input.position_x || 0,
                latitude: input.position_y || 0,
                angularSize: size > 0 ? size : 90,
              };
            }),
          );

          const composite = await compositeEquirect(positionedInputs);
          const compositePath = `${userId}/${sceneId}/composite-input.png`;
          const { publicUrl: compositeUrl } = await downloadAndUploadBuffer(
            composite,
            SUPABASE_BUCKETS.GENERATED_ASSETS,
            compositePath,
          );

          result = await edit360Image([compositeUrl], prompt || undefined, inputs.length > 1);
        } else {
          const textPrompt = prompt || "A beautiful panoramic landscape";
          result = await generate360Image(textPrompt);
        }

        const imageUrl = result.images[0].url;

        const rawResponse = await fetch(imageUrl);
        const rawBuffer = Buffer.from(await rawResponse.arrayBuffer());
        const equirectBuffer = await resizeToEquirect(rawBuffer);

        const storagePath = `${userId}/${sceneId}/equirect_${job.id}.png`;
        const supabaseAdmin = createAdminSupabase();
        const { error: uploadError } = await supabaseAdmin.storage
          .from(SUPABASE_BUCKETS.GENERATED_ASSETS)
          .upload(storagePath, equirectBuffer, {
            upsert: true,
            contentType: "image/png",
          });
        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        const { data: urlData } = supabaseAdmin.storage
          .from(SUPABASE_BUCKETS.GENERATED_ASSETS)
          .getPublicUrl(storagePath);

        await createAsset(sceneId, job.id, "equirect_image", storagePath, urlData.publicUrl, {
          fileSize: equirectBuffer.length,
          width: 4096,
          height: 2048,
        });

        await completeJob(job.id, { description: result.description });
        await logGenerationComplete(logId, "completed", Date.now() - startTime, { description: result.description });
        await updateScene(sceneId, { status: "completed", current_step: null });
        return { success: true };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        await failJob(job.id, errMsg);
        await logGenerationComplete(logId, "failed", Date.now() - startTime, undefined, errMsg);
        await updateScene(sceneId, { status: "failed", current_step: null });
        throw err;
      }
    });
  },
);
