export type WorkflowType = "equirect" | "panorama";
export type PromptMode = "precise" | "creative";

const GENERATE_PROMPTS: Record<WorkflowType, Record<PromptMode, string>> = {
  equirect: {
    precise:
      "Generate a 360 equirectangular image of this scene, adjust view height to match human eye-level, " +
      "adjust distance so the closest object is 1m away. The left and right edges must connect seamlessly.",
    creative:
      "Format: 360 equirectangular. Generate an immersive world out of this scene, make it feel like we are " +
      "watching it as it happens, view height should match human eye-level, closest object is 1m away. " +
      "The left and right edges must connect seamlessly.",
  },
  panorama: {
    precise:
      "Generate a 4:1 panoramic strip of this scene showing a full 360° horizontal view. " +
      "Adjust view height to match human eye-level, adjust distance so the closest object is 1m away. " +
      "The left and right edges must connect seamlessly when wrapped into a cylinder.",
    creative:
      "Format: 4:1 panoramic strip. Generate an immersive world out of this scene, photorealistic, " +
      "make it feel like we are watching it as it happens, view height should match human eye-level, " +
      "closest object is 1m away. The left and right edges must connect seamlessly when wrapped into a cylinder.",
  },
};

export const SEAM_FIX_PROMPT =
  "The photo has a missing seam region running vertically through the center where the left and right edges meet. " +
  "Seamlessly repair this seam area so the left and right halves blend naturally, continuing the scene smoothly " +
  "across the repair zone.";

export const POLE_FILL_PROMPT =
  "Fill the missing region in this wide-angle photo. Complete the missing areas to seamlessly match the " +
  "surrounding environment's surfaces, textures, lighting, and objects. DO NOT CHANGE THE REST OF THE SCENE.";

export const TEXT_ONLY_PROMPTS: Record<WorkflowType, Record<PromptMode, string>> = {
  equirect: {
    precise:
      "Generate a seamless 360-degree equirectangular panoramic image. " +
      "The image must have a 2:1 aspect ratio with the full 360 horizontal field of view. " +
      "The left edge and right edge must connect seamlessly when wrapped into a sphere. " +
      "The top represents the zenith (straight up) and the bottom the nadir (straight down). " +
      "The scene: ",
    creative:
      "Format: 360 equirectangular. Generate an immersive, photorealistic world. " +
      "Make it feel like we are standing inside this scene as it unfolds around us. " +
      "Full spherical coverage, seamless wrap at edges. The scene: ",
  },
  panorama: {
    precise:
      "Generate a 4:1 panoramic strip showing a full 360° horizontal view. " +
      "The strip should connect seamlessly left-to-right when wrapped into a cylinder. " +
      "The scene: ",
    creative:
      "Format: 4:1 panoramic strip. Generate an immersive, photorealistic world as a 360° panoramic band. " +
      "Seamless left-right wrap when rolled into a cylinder. The scene: ",
  },
};

export function getGeneratePrompt(
  workflow: WorkflowType,
  mode: PromptMode,
): string {
  return GENERATE_PROMPTS[workflow][mode];
}

export function getTextOnlyPrompt(
  workflow: WorkflowType,
  mode: PromptMode,
  userPrompt: string,
): string {
  return `${TEXT_ONLY_PROMPTS[workflow][mode]}${userPrompt}`;
}

export function getRefImagePrompt(
  workflow: WorkflowType,
  mode: PromptMode,
  userPrompt?: string,
): string {
  const base = GENERATE_PROMPTS[workflow][mode];
  return userPrompt ? `${base} ${userPrompt}` : base;
}

export function getMultiImagePrompt(
  workflow: WorkflowType,
  mode: PromptMode,
  positions: { index: number; slot: string }[],
  userPrompt?: string,
): string {
  const base = GENERATE_PROMPTS[workflow][mode];
  const posDesc = positions
    .map((p) => `Image ${p.index + 1} shows the ${p.slot} of the scene`)
    .join(". ");
  const full = `${base} Reference layout: ${posDesc}.`;
  return userPrompt ? `${full} ${userPrompt}` : full;
}

export interface WorkflowConfig {
  workflow: WorkflowType;
  generateAspectRatio: string;
  seamAspectRatio: string;
  fillAspectRatio: string;
  defaults: {
    stripWidth: number;
    poleFov: number;
    featherDeg: number;
    vertCoverage?: number;
    captureYaw?: number;
    captureFov?: number;
  };
}

export const WORKFLOW_CONFIGS: Record<WorkflowType, WorkflowConfig> = {
  equirect: {
    workflow: "equirect",
    generateAspectRatio: "21:9",
    seamAspectRatio: "4:3",
    fillAspectRatio: "1:1",
    defaults: {
      stripWidth: 10,
      poleFov: 120,
      featherDeg: 3,
    },
  },
  panorama: {
    workflow: "panorama",
    generateAspectRatio: "4:1",
    seamAspectRatio: "4:3",
    fillAspectRatio: "1:1",
    defaults: {
      stripWidth: 10,
      poleFov: 120,
      featherDeg: 3,
      vertCoverage: 75,
      captureYaw: -15,
      captureFov: 120,
    },
  },
};
