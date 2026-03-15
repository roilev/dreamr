import { GEMINI_MODELS, FAL_MODELS } from "@/lib/utils/constants";
import type { ImageResult, ImageSize } from "@/lib/gemini/image-generation";

export type { ImageResult, ImageSize };

export type ImageProvider = "gemini" | "fal";

export function getImageProvider(): ImageProvider {
  const env = process.env.IMAGE_PROVIDER?.toLowerCase();
  if (env === "fal") return "fal";
  return "gemini";
}

interface GenerateOptions {
  prompt: string;
  aspectRatio?: string;
  imageSize?: ImageSize;
}

interface EditOptions {
  prompt: string;
  imageBuffers: Buffer[];
  imageUrls?: string[];
  aspectRatio?: string;
  imageSize?: ImageSize;
}

// ---------- Fal adapter: wraps fal functions to return ImageResult ----------

async function falUrlToBuffer(url: string): Promise<Buffer> {
  const resp = await fetch(url);
  return Buffer.from(await resp.arrayBuffer());
}

async function falGenerate(opts: GenerateOptions): Promise<ImageResult> {
  const { generateImage } = await import("@/lib/fal/nano-banana");
  const result = await generateImage({
    prompt: opts.prompt,
    aspectRatio: opts.aspectRatio,
    resolution: opts.imageSize as "0.5K" | "1K" | "2K" | "4K" | undefined,
  });
  const img = result.images[0];
  return {
    buffer: await falUrlToBuffer(img.url),
    width: img.width,
    height: img.height,
    mimeType: img.content_type || "image/png",
    description: result.description,
  };
}

async function falEdit(opts: EditOptions): Promise<ImageResult> {
  const { editImage } = await import("@/lib/fal/nano-banana");
  if (!opts.imageUrls?.length) {
    throw new Error("[fal] editImage requires imageUrls when using fal provider");
  }
  const result = await editImage({
    prompt: opts.prompt,
    imageUrls: opts.imageUrls,
    aspectRatio: opts.aspectRatio,
    resolution: opts.imageSize as "0.5K" | "1K" | "2K" | "4K" | undefined,
  });
  const img = result.images[0];
  return {
    buffer: await falUrlToBuffer(img.url),
    width: img.width,
    height: img.height,
    mimeType: img.content_type || "image/png",
    description: result.description,
  };
}

async function falInpaintSeam(
  imageBuffer: Buffer,
  imageUrl: string | undefined,
  prompt: string,
  imageSize?: ImageSize,
): Promise<ImageResult> {
  const { inpaintSeam } = await import("@/lib/fal/nano-banana");
  if (!imageUrl) throw new Error("[fal] inpaintSeam requires a URL when using fal provider");
  const result = await inpaintSeam(
    imageUrl,
    prompt,
    (imageSize as "0.5K" | "1K" | "2K" | "4K") || "4K",
  );
  const img = result.images[0];
  return {
    buffer: await falUrlToBuffer(img.url),
    width: img.width,
    height: img.height,
    mimeType: img.content_type || "image/png",
    description: result.description,
  };
}

async function falFillPoleCapture(
  imageBuffer: Buffer,
  imageUrl: string | undefined,
  prompt: string,
  imageSize?: ImageSize,
): Promise<ImageResult> {
  const { fillPoleCapture } = await import("@/lib/fal/nano-banana");
  if (!imageUrl) throw new Error("[fal] fillPoleCapture requires a URL when using fal provider");
  const result = await fillPoleCapture(
    imageUrl,
    prompt,
    (imageSize as "0.5K" | "1K" | "2K" | "4K") || "4K",
  );
  const img = result.images[0];
  return {
    buffer: await falUrlToBuffer(img.url),
    width: img.width,
    height: img.height,
    mimeType: img.content_type || "image/png",
    description: result.description,
  };
}

// ---------- Gemini adapter ----------

async function geminiGenerate(opts: GenerateOptions): Promise<ImageResult> {
  const { generateImage } = await import("@/lib/gemini/image-generation");
  return generateImage(opts);
}

async function geminiEdit(opts: EditOptions): Promise<ImageResult> {
  const { editImage } = await import("@/lib/gemini/image-generation");
  return editImage({
    prompt: opts.prompt,
    imageBuffers: opts.imageBuffers,
    aspectRatio: opts.aspectRatio,
    imageSize: opts.imageSize,
  });
}

async function geminiInpaintSeam(
  imageBuffer: Buffer,
  _imageUrl: string | undefined,
  prompt: string,
  imageSize?: ImageSize,
): Promise<ImageResult> {
  const { inpaintSeam } = await import("@/lib/gemini/image-generation");
  return inpaintSeam(imageBuffer, prompt, imageSize);
}

async function geminiFillPoleCapture(
  imageBuffer: Buffer,
  _imageUrl: string | undefined,
  prompt: string,
  imageSize?: ImageSize,
): Promise<ImageResult> {
  const { fillPoleCapture } = await import("@/lib/gemini/image-generation");
  return fillPoleCapture(imageBuffer, prompt, imageSize);
}

// ---------- Public API ----------

export async function generateImage(opts: GenerateOptions): Promise<ImageResult> {
  const provider = getImageProvider();
  console.log(`[provider] generateImage via ${provider}`);
  return provider === "gemini" ? geminiGenerate(opts) : falGenerate(opts);
}

export async function editImage(opts: EditOptions): Promise<ImageResult> {
  const provider = getImageProvider();
  console.log(`[provider] editImage via ${provider}`);
  return provider === "gemini" ? geminiEdit(opts) : falEdit(opts);
}

export async function inpaintSeam(
  imageBuffer: Buffer,
  imageUrl: string | undefined,
  prompt: string,
  imageSize?: ImageSize,
): Promise<ImageResult> {
  const provider = getImageProvider();
  console.log(`[provider] inpaintSeam via ${provider}`);
  return provider === "gemini"
    ? geminiInpaintSeam(imageBuffer, imageUrl, prompt, imageSize)
    : falInpaintSeam(imageBuffer, imageUrl, prompt, imageSize);
}

export async function fillPoleCapture(
  imageBuffer: Buffer,
  imageUrl: string | undefined,
  prompt: string,
  imageSize?: ImageSize,
): Promise<ImageResult> {
  const provider = getImageProvider();
  console.log(`[provider] fillPoleCapture via ${provider}`);
  return provider === "gemini"
    ? geminiFillPoleCapture(imageBuffer, imageUrl, prompt, imageSize)
    : falFillPoleCapture(imageBuffer, imageUrl, prompt, imageSize);
}

export function getProviderInfo(): { provider: ImageProvider; modelId: string } {
  const provider = getImageProvider();
  if (provider === "gemini") {
    return { provider: "gemini", modelId: GEMINI_MODELS.FLASH_IMAGE };
  }
  return { provider: "fal", modelId: FAL_MODELS.NANO_BANANA_2 };
}
