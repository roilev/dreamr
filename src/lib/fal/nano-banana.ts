import { fal } from "./client";
import type { NanoBanana2Input, NanoBanana2EditInput, NanoBanana2Output } from "./types";
import { FAL_MODELS } from "@/lib/utils/constants";

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
    aspect_ratio: "21:9",
    resolution: "4K",
    output_format: "png",
    limit_generations: true,
  };

  const result = await fal.subscribe(FAL_MODELS.NANO_BANANA_2, {
    input,
    logs: true,
  });

  return result.data as NanoBanana2Output;
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
    aspect_ratio: "21:9",
    resolution: "4K",
    output_format: "png",
    limit_generations: true,
  };

  const result = await fal.subscribe(FAL_MODELS.NANO_BANANA_2_EDIT, {
    input,
    logs: true,
  });

  return result.data as NanoBanana2Output;
}
