import { getAI } from "./client";
import { GEMINI_MODELS } from "@/lib/utils/constants";
import type { Modality, GenerateContentResponse } from "@google/genai";

export type ImageSize = "512" | "1K" | "2K" | "4K";

export interface ImageResult {
  buffer: Buffer;
  width?: number;
  height?: number;
  mimeType: string;
  description?: string;
}

interface GenerateOptions {
  prompt: string;
  aspectRatio?: string;
  imageSize?: ImageSize;
}

interface EditOptions {
  prompt: string;
  imageBuffers: Buffer[];
  aspectRatio?: string;
  imageSize?: ImageSize;
}

function buildContentParts(
  prompt: string,
  imageBuffers?: Buffer[],
): Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  if (imageBuffers?.length) {
    for (const buf of imageBuffers) {
      parts.push({
        inlineData: {
          mimeType: "image/png",
          data: buf.toString("base64"),
        },
      });
    }
  }

  parts.push({ text: prompt });
  return parts;
}

function extractImageResult(response: GenerateContentResponse): ImageResult {
  const candidates = response.candidates;
  if (!candidates?.length) {
    throw new Error("[gemini] No candidates in response");
  }

  const parts = candidates[0].content?.parts;
  if (!parts?.length) {
    throw new Error("[gemini] No parts in response");
  }

  let imageBuffer: Buffer | null = null;
  let mimeType = "image/png";
  let description: string | undefined;

  for (const part of parts) {
    if (part.inlineData?.data) {
      imageBuffer = Buffer.from(part.inlineData.data, "base64");
      mimeType = part.inlineData.mimeType || "image/png";
    } else if (part.text) {
      description = part.text;
    }
  }

  if (!imageBuffer) {
    throw new Error("[gemini] Response contained no image data");
  }

  console.log(
    `[gemini] image: ${imageBuffer.length} bytes, mime: ${mimeType}` +
    (description ? `, description: ${description.slice(0, 80)}...` : ""),
  );

  return { buffer: imageBuffer, mimeType, description };
}

async function callGemini(
  prompt: string,
  imageBuffers: Buffer[] | undefined,
  aspectRatio: string,
  imageSize: ImageSize,
): Promise<ImageResult> {
  const contents = buildContentParts(prompt, imageBuffers);

  const ai = getAI();
  const response = await ai.models.generateContent({
    model: GEMINI_MODELS.FLASH_IMAGE,
    contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"] as Modality[],
      imageConfig: {
        aspectRatio,
        imageSize,
      },
    },
  });

  return extractImageResult(response);
}

export async function generateImage(opts: GenerateOptions): Promise<ImageResult> {
  return callGemini(
    opts.prompt,
    undefined,
    opts.aspectRatio ?? "21:9",
    opts.imageSize ?? "2K",
  );
}

export async function editImage(opts: EditOptions): Promise<ImageResult> {
  if (!opts.imageBuffers.length) {
    throw new Error("[gemini] editImage requires at least one image buffer");
  }

  return callGemini(
    opts.prompt,
    opts.imageBuffers,
    opts.aspectRatio ?? "21:9",
    opts.imageSize ?? "2K",
  );
}

export async function inpaintSeam(
  imageBuffer: Buffer,
  prompt: string,
  imageSize: ImageSize = "2K",
): Promise<ImageResult> {
  return callGemini(prompt, [imageBuffer], "4:3", imageSize);
}

export async function fillPoleCapture(
  imageBuffer: Buffer,
  prompt: string,
  imageSize: ImageSize = "2K",
): Promise<ImageResult> {
  return callGemini(prompt, [imageBuffer], "1:1", imageSize);
}
