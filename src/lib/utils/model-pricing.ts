/**
 * fal.ai model pricing — sourced from actual fal.ai usage export.
 * Update this file when pricing changes.
 *
 * Pricing types:
 *   "per_image"    — flat cost per generated image
 *   "per_second"   — cost per second of output video
 *   "per_mpx"      — cost per megapixel of output (width × height × frames)
 *   "per_compute_s" — cost per compute second
 */

export interface ModelPricing {
  displayName: string;
  type: "per_image" | "per_second" | "per_mpx" | "per_compute_s";
  /** Cost per unit in USD */
  unitCost: number;
  unit: string;
  /** Default units when exact output info isn't available */
  defaultUnits: number;
  note?: string;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // ── Image generation ──
  "fal-ai/nano-banana-2": {
    displayName: "Nano Banana 2 (Text → Image)",
    type: "per_image",
    unitCost: 0.08,
    unit: "images",
    defaultUnits: 1,
    note: "$0.08/image at 1K",
  },
  "fal-ai/nano-banana-2/edit": {
    displayName: "Nano Banana 2 (Image Edit)",
    type: "per_image",
    unitCost: 0.08,
    unit: "images",
    defaultUnits: 1,
    note: "$0.08/image at 1K",
  },

  // ── Video generation ──
  "fal-ai/veo3.1/image-to-video": {
    displayName: "Veo 3.1 (Image → Video)",
    type: "per_second",
    unitCost: 0.40,
    unit: "seconds",
    defaultUnits: 4,
    note: "$0.40/s (1080p)",
  },
  "fal-ai/veo3.1": {
    displayName: "Veo 3.1 (Text → Video)",
    type: "per_second",
    unitCost: 0.40,
    unit: "seconds",
    defaultUnits: 4,
    note: "$0.40/s (1080p)",
  },
  "fal-ai/veo3/fast": {
    displayName: "Veo 3 Fast",
    type: "per_second",
    unitCost: 0.10,
    unit: "seconds",
    defaultUnits: 8,
    note: "$0.10/s no audio",
  },
  "fal-ai/veo3/fast/image-to-video": {
    displayName: "Veo 3 Fast (Image → Video)",
    type: "per_second",
    unitCost: 0.10,
    unit: "seconds",
    defaultUnits: 8,
    note: "$0.10/s no audio",
  },

  // ── Upscaling ──
  "fal-ai/seedvr/upscale/video": {
    displayName: "SeedVR2 Video Upscale",
    type: "per_mpx",
    unitCost: 0.001,
    unit: "megapixels",
    defaultUnits: 708,
    note: "$0.001/megapixel",
  },

  // ── Depth estimation ──
  "fal-ai/image-preprocessors/depth-anything/v2": {
    displayName: "Depth Anything V2",
    type: "per_compute_s",
    unitCost: 0.0013,
    unit: "compute seconds",
    defaultUnits: 5,
    note: "$0.0013/compute second",
  },
  "fal-ai/imageutils/marigold-depth": {
    displayName: "Marigold Depth",
    type: "per_compute_s",
    unitCost: 0.0013,
    unit: "compute seconds",
    defaultUnits: 5,
    note: "~$0.0013/compute second",
  },
};

/**
 * Estimate cost for a completed generation job.
 * Returns 0 for non-completed jobs.
 */
export function estimateJobCost(job: {
  model_id: string | null;
  step: string;
  status: string;
}): number {
  if (job.status !== "completed") return 0;

  const pricing = job.model_id ? MODEL_PRICING[job.model_id] : null;
  if (!pricing) {
    return STEP_FALLBACK_COST[job.step] ?? 0;
  }

  return pricing.unitCost * pricing.defaultUnits;
}

/**
 * Get a human-readable display name for a model ID.
 */
export function getModelDisplayName(modelId: string): string {
  return MODEL_PRICING[modelId]?.displayName ?? formatFallbackName(modelId);
}

/** Fallback costs by step when model_id isn't in the pricing table */
const STEP_FALLBACK_COST: Record<string, number> = {
  image_360: 0.08,
  video: 1.60,
  upscale: 0.71,
  depth: 0.0065,
  world: 0.50,
};

function formatFallbackName(modelId: string): string {
  const parts = modelId.split("/");
  if (parts.length <= 1) return modelId;
  const meaningful = parts.filter((p) => p !== "fal-ai");
  return meaningful
    .map((p) => p.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(" — ");
}
