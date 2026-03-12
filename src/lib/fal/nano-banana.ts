import { fal } from "./client";
import type { NanoBanana2Input, NanoBanana2EditInput, NanoBanana2Output } from "./types";
import { FAL_MODELS } from "@/lib/utils/constants";

type Resolution = NanoBanana2Input["resolution"];

interface GenerateOptions {
  prompt: string;
  aspectRatio?: string;
  resolution?: Resolution;
}

interface EditOptions {
  prompt: string;
  imageUrls: string[];
  aspectRatio?: string;
  resolution?: Resolution;
}

function logDimensions(label: string, output: NanoBanana2Output) {
  const img = output.images[0];
  if (img?.width && img?.height) {
    console.log(`[fal.ai] ${label}: ${img.width}x${img.height} (ratio ${(img.width / img.height).toFixed(4)})`);
  }
}

/**
 * Generate an image from text prompt only.
 * Used for text-only generation (no reference images).
 */
export async function generateImage(opts: GenerateOptions): Promise<NanoBanana2Output> {
  const input: NanoBanana2Input = {
    prompt: opts.prompt,
    aspect_ratio: opts.aspectRatio ?? "auto",
    resolution: opts.resolution ?? "4K",
    output_format: "png",
    limit_generations: true,
  };

  const result = await fal.subscribe(FAL_MODELS.NANO_BANANA_2, { input, logs: true });
  const output = result.data as NanoBanana2Output;
  logDimensions("generate", output);
  return output;
}

/**
 * Edit/generate an image using one or more reference images.
 * Sends raw images as individual references to the edit endpoint.
 */
export async function editImage(opts: EditOptions): Promise<NanoBanana2Output> {
  const input: NanoBanana2EditInput = {
    prompt: opts.prompt,
    image_urls: opts.imageUrls,
    aspect_ratio: opts.aspectRatio ?? "auto",
    resolution: opts.resolution ?? "4K",
    output_format: "png",
    limit_generations: true,
  };

  const result = await fal.subscribe(FAL_MODELS.NANO_BANANA_2_EDIT, { input, logs: true });
  const output = result.data as NanoBanana2Output;
  logDimensions("edit", output);
  return output;
}

/**
 * Inpaint a seam region. Input is a 4:3 crop with a transparent strip
 * where the seam should be repaired.
 */
export async function inpaintSeam(
  imageUrl: string,
  prompt: string,
  resolution: Resolution = "4K",
): Promise<NanoBanana2Output> {
  const input: NanoBanana2EditInput = {
    prompt,
    image_urls: [imageUrl],
    aspect_ratio: "4:3",
    resolution,
    output_format: "png",
    limit_generations: true,
  };

  const result = await fal.subscribe(FAL_MODELS.NANO_BANANA_2_EDIT, { input, logs: true });
  const output = result.data as NanoBanana2Output;
  logDimensions("seam-inpaint", output);
  return output;
}

/**
 * Fill missing regions in a pole capture (top or bottom).
 * Input is a 1:1 perspective view with transparent holes.
 */
export async function fillPoleCapture(
  imageUrl: string,
  prompt: string,
  resolution: Resolution = "4K",
): Promise<NanoBanana2Output> {
  const input: NanoBanana2EditInput = {
    prompt,
    image_urls: [imageUrl],
    aspect_ratio: "1:1",
    resolution,
    output_format: "png",
    limit_generations: true,
  };

  const result = await fal.subscribe(FAL_MODELS.NANO_BANANA_2_EDIT, { input, logs: true });
  const output = result.data as NanoBanana2Output;
  logDimensions("pole-fill", output);
  return output;
}
