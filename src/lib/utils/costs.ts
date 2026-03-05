export const MODEL_COSTS: Record<string, number> = {
  "fal-ai/nano-banana-2": 0.08,
  "fal-ai/nano-banana-2/edit": 0.16,
  "fal-ai/veo3.1": 0.50,
  "fal-ai/veo3/fast": 0.25,
  "fal-ai/seedvr/upscale/video": 0.30,
  "fal-ai/image-preprocessors/depth-anything/v2": 0.02,
  "fal-ai/imageutils/marigold-depth": 0.03,
  "marble-world-gen": 1.00,
};

export function estimateCost(modelId: string): number {
  return MODEL_COSTS[modelId] ?? 0;
}
