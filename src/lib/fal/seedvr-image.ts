import { fal } from "./client";
import { FAL_MODELS } from "@/lib/utils/constants";

export async function upscaleImage(
  imageUrl: string,
  options: {
    upscaleFactor?: number;
  } = {},
): Promise<{ imageUrl: string }> {
  const result = await fal.subscribe(FAL_MODELS.SEEDVR_UPSCALE_IMAGE, {
    input: {
      image_url: imageUrl,
      upscale_factor: options.upscaleFactor ?? 2,
      output_format: "png",
    } as never,
    logs: true,
  });

  const data = result.data as { image?: { url: string }; images?: { url: string }[] };
  const url = data.image?.url ?? data.images?.[0]?.url;
  if (!url) throw new Error("No image returned from upscale model");
  return { imageUrl: url };
}
