// Text2img endpoint: fal-ai/nano-banana-2
export interface NanoBanana2Input {
  prompt: string;
  num_images?: number;
  seed?: number;
  aspect_ratio?: string;
  output_format?: "png" | "jpeg" | "webp";
  safety_tolerance?: "1" | "2" | "3" | "4" | "5" | "6";
  resolution?: "0.5K" | "1K" | "2K" | "4K";
  limit_generations?: boolean;
  enable_web_search?: boolean;
  sync_mode?: boolean;
}

// Edit endpoint: fal-ai/nano-banana-2/edit
export interface NanoBanana2EditInput {
  prompt: string;
  image_urls: string[];
  num_images?: number;
  seed?: number;
  aspect_ratio?: string;
  output_format?: "png" | "jpeg" | "webp";
  safety_tolerance?: "1" | "2" | "3" | "4" | "5" | "6";
  resolution?: "0.5K" | "1K" | "2K" | "4K";
  limit_generations?: boolean;
  enable_web_search?: boolean;
  sync_mode?: boolean;
}

export interface FalImageFile {
  url: string;
  content_type?: string;
  file_name?: string;
  file_size?: number;
  width?: number;
  height?: number;
}

export interface NanoBanana2Output {
  images: FalImageFile[];
  description: string;
}

// Keep old types for Veo, SeedVR, Depth (these are used by other wrappers)

export type VeoModel = "fal-ai/veo3.1/image-to-video" | "fal-ai/veo3.1" | "fal-ai/veo3/fast";

export interface VeoInput {
  prompt: string;
  aspect_ratio?: string;
  duration?: string;
  image_url?: string;
  enhance_prompt?: boolean;
}

export interface VeoOutput {
  video: {
    url: string;
    content_type: string;
    file_name?: string;
    file_size?: number;
  };
}

export interface SeedVRInput {
  video_url: string;
  target_resolution?: string;
}

export interface SeedVROutput {
  video: { url: string; content_type: string };
}

export type DepthModel =
  | "fal-ai/image-preprocessors/depth-anything/v2"
  | "fal-ai/imageutils/marigold-depth";

export interface DepthInput {
  image_url: string;
}

export interface DepthOutput {
  image: { url: string; width: number; height: number; content_type: string };
}
