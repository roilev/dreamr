export type WorkflowType = "equirect" | "panorama";
export type PromptMode = "precise" | "creative";

const REF_IMAGE_PROMPTS: Record<WorkflowType, Record<PromptMode, string>> = {
  equirect: {
    precise:
      "Generate a 360 equirectangular image based on the provided reference image(s){{SCENE}}. " +
      "Adjust view height to match human eye-level, " +
      "adjust distance so the closest object is 1m away. The left and right edges must connect seamlessly.",
    creative:
      "Format: 360 equirectangular. Using the provided reference image(s){{SCENE}}, generate an immersive world — " +
      "make it feel like we are watching it as it happens, view height should match human eye-level, " +
      "closest object is 1m away. The left and right edges must connect seamlessly.",
  },
  panorama: {
    precise:
      "Generate a 4:1 panoramic strip based on the provided reference image(s){{SCENE}}, " +
      "showing a full 360° horizontal view. " +
      "Adjust view height to match human eye-level, adjust distance so the closest object is 1m away. " +
      "The left and right edges must connect seamlessly when wrapped into a cylinder.",
    creative:
      "Format: 4:1 panoramic strip. Using the provided reference image(s){{SCENE}}, " +
      "generate an immersive, photorealistic world — " +
      "make it feel like we are watching it as it happens, view height should match human eye-level, " +
      "closest object is 1m away. The left and right edges must connect seamlessly when wrapped into a cylinder.",
  },
};

export const SEAM_FIX_PROMPT =
  "The photo has a missing seam region running vertically through the center where the left and right edges meet. " +
  "Seamlessly repair this seam area so the left and right halves blend naturally, continuing the scene smoothly " +
  "across the repair zone.";

export const POLE_FILL_PROMPT =
  "The white circular region in the center is missing and needs to be filled in. " +
  "Extend the surrounding scene inward to complete the image. " +
  "Match the perspective, lighting, colors, and textures of the surrounding area exactly. " +
  "The boundary between the filled area and the existing image must be invisible — " +
  "no seam, no edge, no change in tone. " +
  "Do not modify anything outside the white circle.";

const TEXT_ONLY_PROMPTS: Record<WorkflowType, Record<PromptMode, { prefix: string; suffix: string }>> = {
  equirect: {
    precise: {
      prefix:
        "Generate a seamless 360-degree equirectangular panoramic image of ",
      suffix:
        ". The image must have a 2:1 aspect ratio with the full 360 horizontal field of view. " +
        "The left edge and right edge must connect seamlessly when wrapped into a sphere. " +
        "The top represents the zenith (straight up) and the bottom the nadir (straight down).",
    },
    creative: {
      prefix:
        "Format: 360 equirectangular. Generate an immersive, photorealistic world depicting ",
      suffix:
        ". Make it feel like we are standing inside this scene as it unfolds around us. " +
        "Full spherical coverage, seamless wrap at edges.",
    },
  },
  panorama: {
    precise: {
      prefix:
        "Generate a 4:1 panoramic strip showing a full 360° horizontal view of ",
      suffix:
        ". The strip should connect seamlessly left-to-right when wrapped into a cylinder.",
    },
    creative: {
      prefix:
        "Format: 4:1 panoramic strip. Generate an immersive, photorealistic world depicting ",
      suffix:
        " as a 360° panoramic band. Seamless left-right wrap when rolled into a cylinder.",
    },
  },
};

function insertScene(template: string, userPrompt?: string): string {
  const sceneClause = userPrompt
    ? ` depicting "${userPrompt}"`
    : "";
  return template.replace("{{SCENE}}", sceneClause);
}

export function getTextOnlyPrompt(
  workflow: WorkflowType,
  mode: PromptMode,
  userPrompt: string,
): string {
  const { prefix, suffix } = TEXT_ONLY_PROMPTS[workflow][mode];
  return `${prefix}${userPrompt}${suffix}`;
}

export function getRefImagePrompt(
  workflow: WorkflowType,
  mode: PromptMode,
  userPrompt?: string,
): string {
  return insertScene(REF_IMAGE_PROMPTS[workflow][mode], userPrompt);
}

export function getMultiImagePrompt(
  workflow: WorkflowType,
  mode: PromptMode,
  positions: { index: number; slot: string }[],
  userPrompt?: string,
): string {
  const base = insertScene(REF_IMAGE_PROMPTS[workflow][mode], userPrompt);
  const posDesc = positions
    .map((p) => `Image ${p.index + 1} shows the ${p.slot} of the scene`)
    .join(". ");
  return `${base} Reference layout: ${posDesc}.`;
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
