import { fal } from "./client";
import type { VeoModel, VeoOutput } from "./types";

export async function generateVideo(
  imageUrl: string,
  animationPrompt: string,
  options: {
    model?: VeoModel;
    duration?: "4s" | "6s" | "8s";
    generateAudio?: boolean;
  } = {},
): Promise<{ requestId: string }> {
  const model = options.model ?? "fal-ai/veo3.1/image-to-video";

  const { request_id } = await fal.queue.submit(model, {
    input: {
      prompt: animationPrompt,
      image_url: imageUrl,
      duration: options.duration ?? "8s",
      aspect_ratio: "16:9",
      generate_audio: options.generateAudio ?? false,
    } as never,
  });

  return { requestId: request_id };
}

export async function checkVideoStatus(
  requestId: string,
  model: VeoModel = "fal-ai/veo3.1/image-to-video",
) {
  return fal.queue.status(model, { requestId, logs: true });
}

export async function getVideoResult(
  requestId: string,
  model: VeoModel = "fal-ai/veo3.1/image-to-video",
): Promise<VeoOutput> {
  const result = await fal.queue.result(model, { requestId });
  return result.data as unknown as VeoOutput;
}
