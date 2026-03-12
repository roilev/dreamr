import { fal } from "./client";
import type { NanoBanana2Input, NanoBanana2EditInput, NanoBanana2Output } from "./types";
import { FAL_MODELS } from "@/lib/utils/constants";

const EQUIRECT_POLE_FILL_PROMPT =
  "Complete the zenith and nadir of this equirectangular panoramic image. " +
  "The black regions at the top and bottom represent missing pole content. " +
  "Fill them with natural sky/ceiling content (top) and ground/floor content (bottom) " +
  "that seamlessly blends with the existing scene. " +
  "Maintain consistent lighting, color palette, and artistic style. " +
  "The output must be a valid equirectangular projection at 2:1 aspect ratio.";

export const EQUIRECT_TEXT_PROMPT =
  "Generate a seamless 360-degree equirectangular panoramic image. " +
  "The image must have a 2:1 aspect ratio with the full 360 horizontal field of view. " +
  "The left edge and right edge must connect seamlessly when wrapped into a sphere. " +
  "The top represents the zenith (straight up) and the bottom the nadir (straight down). " +
  "Avoid visible seams, distortion artifacts, or repeated patterns at the wrap boundary. " +
  "The scene: ";

export const EQUIRECT_SINGLE_IMAGE_PROMPT =
  "Expand this reference image into a complete seamless 360-degree equirectangular panoramic image. " +
  "The reference image is placed within a 2:1 equirectangular projection canvas. " +
  "Fill the remaining areas by naturally extending the scene in all directions, " +
  "maintaining consistent lighting, color palette, perspective, and artistic style. " +
  "The left and right edges of the output must connect seamlessly when wrapped into a sphere. " +
  "Produce a full spherical panorama suitable for VR viewing. ";

export const EQUIRECT_COMPOSITE_PROMPT =
  "Complete this partial 360-degree equirectangular panoramic image. " +
  "Multiple reference images have been placed at specific positions on a 2:1 equirectangular canvas. " +
  "Fill all remaining empty/dark areas with generated content that seamlessly blends " +
  "with the existing image regions. Maintain consistent lighting, perspective, and style. " +
  "The left and right edges must connect seamlessly when wrapped. " +
  "Produce a full spherical panorama suitable for VR viewing. ";

export async function generate360Image(userPrompt: string): Promise<NanoBanana2Output> {
  const input: NanoBanana2Input = {
    prompt: `${EQUIRECT_TEXT_PROMPT}${userPrompt}`,
    aspect_ratio: "auto",
    resolution: "4K",
    output_format: "png",
    limit_generations: true,
  };

  const result = await fal.subscribe(FAL_MODELS.NANO_BANANA_2, {
    input,
    logs: true,
  });

  const output = result.data as NanoBanana2Output;
  const img = output.images[0];
  if (img?.width && img?.height) {
    console.log(`[fal.ai] Raw output: ${img.width}x${img.height} (ratio ${(img.width / img.height).toFixed(4)})`);
  }

  return output;
}

export async function edit360Image(
  imageUrls: string[],
  userPrompt?: string,
  isMultipleSource?: boolean,
): Promise<NanoBanana2Output> {
  const promptPrefix = isMultipleSource ? EQUIRECT_COMPOSITE_PROMPT : EQUIRECT_SINGLE_IMAGE_PROMPT;
  const prompt = userPrompt ? `${promptPrefix}${userPrompt}` : promptPrefix.trim();

  const input: NanoBanana2EditInput = {
    prompt,
    image_urls: imageUrls,
    aspect_ratio: "auto",
    resolution: "4K",
    output_format: "png",
    limit_generations: true,
  };

  const result = await fal.subscribe(FAL_MODELS.NANO_BANANA_2_EDIT, {
    input,
    logs: true,
  });

  const output = result.data as NanoBanana2Output;
  const img = output.images[0];
  if (img?.width && img?.height) {
    console.log(`[fal.ai] Raw edit output: ${img.width}x${img.height} (ratio ${(img.width / img.height).toFixed(4)})`);
  }

  return output;
}

/**
 * Double-pass pole fill: takes a letterboxed equirectangular image (with black
 * bars at top/bottom for missing pole content) and uses the edit endpoint to
 * inpaint the poles while preserving the good horizon content.
 */
export async function fillEquirectPoles(
  letterboxedImageUrl: string,
  sceneDescription?: string,
): Promise<NanoBanana2Output> {
  const prompt = sceneDescription
    ? `${EQUIRECT_POLE_FILL_PROMPT} Scene context: ${sceneDescription}`
    : EQUIRECT_POLE_FILL_PROMPT;

  const input: NanoBanana2EditInput = {
    prompt,
    image_urls: [letterboxedImageUrl],
    aspect_ratio: "auto",
    resolution: "4K",
    output_format: "png",
    limit_generations: true,
  };

  const result = await fal.subscribe(FAL_MODELS.NANO_BANANA_2_EDIT, {
    input,
    logs: true,
  });

  const output = result.data as NanoBanana2Output;
  const img = output.images[0];
  if (img?.width && img?.height) {
    console.log(`[fal.ai] Pole fill output: ${img.width}x${img.height} (ratio ${(img.width / img.height).toFixed(4)})`);
  }

  return output;
}
