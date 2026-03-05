export const APP_NAME = "Dreamr";

export const PIPELINE_STEPS = [
  "image_360",
  "video",
  "upscale",
  "depth",
  "world",
] as const;

export const PIPELINE_STEP_LABELS: Record<
  (typeof PIPELINE_STEPS)[number],
  string
> = {
  image_360: "360° Image",
  video: "Video",
  upscale: "Upscale",
  depth: "Depth",
  world: "3D World",
};

export const SUPABASE_BUCKETS = {
  SCENE_INPUTS: "scene-inputs",
  GENERATED_ASSETS: "generated-assets",
  PUBLIC_ASSETS: "public-assets",
} as const;

export const FAL_MODELS = {
  NANO_BANANA_2: "fal-ai/nano-banana-2",
  NANO_BANANA_2_EDIT: "fal-ai/nano-banana-2/edit",
  VEO_3_1: "fal-ai/veo3.1/image-to-video",
  VEO_3_1_TEXT: "fal-ai/veo3.1",
  VEO_3_FAST: "fal-ai/veo3/fast",
  SEEDVR_UPSCALE: "fal-ai/seedvr/upscale/video",
  DEPTH_ANYTHING_V2: "fal-ai/image-preprocessors/depth-anything/v2",
  MARIGOLD_DEPTH: "fal-ai/imageutils/marigold-depth",
} as const;
