import { fal } from "./client";
import type { DepthModel, DepthOutput } from "./types";
import { FAL_MODELS } from "@/lib/utils/constants";

export async function estimateDepth(
  imageUrl: string,
  options: {
    model?: DepthModel;
    marigoldSteps?: number;
    marigoldEnsembleSize?: number;
  } = {},
): Promise<DepthOutput> {
  const model = options.model ?? FAL_MODELS.DEPTH_ANYTHING_V2;

  const input: Record<string, unknown> = { image_url: imageUrl };

  if (model === FAL_MODELS.MARIGOLD_DEPTH) {
    input.num_inference_steps = options.marigoldSteps ?? 10;
    input.ensemble_size = options.marigoldEnsembleSize ?? 10;
  }

  const result = await fal.subscribe(model, { input: input as never, logs: true });
  return result.data as unknown as DepthOutput;
}

export async function estimateDepthBatch(
  frameUrls: string[],
  model: DepthModel = FAL_MODELS.DEPTH_ANYTHING_V2,
): Promise<DepthOutput[]> {
  return Promise.all(frameUrls.map((url) => estimateDepth(url, { model })));
}
