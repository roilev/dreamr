import { fal } from "./client";
import { FAL_MODELS } from "@/lib/utils/constants";

export async function upscaleVideo(
  videoUrl: string,
  options: {
    upscaleFactor?: number;
    targetResolution?: "720p" | "1080p" | "1440p" | "2160p";
  } = {},
): Promise<{ requestId: string }> {
  const input: Record<string, unknown> = {
    video_url: videoUrl,
  };

  if (options.targetResolution) {
    input.target_resolution = options.targetResolution;
  } else {
    input.upscale_factor = options.upscaleFactor ?? 2;
  }

  const { request_id } = await fal.queue.submit(FAL_MODELS.SEEDVR_UPSCALE, {
    input: input as never,
  });

  return { requestId: request_id };
}
