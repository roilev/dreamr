import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { stepImage360, stepVideo, stepUpscale, stepDepth, worldGeneration } from "@/lib/inngest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [stepImage360, stepVideo, stepUpscale, stepDepth, worldGeneration],
});
