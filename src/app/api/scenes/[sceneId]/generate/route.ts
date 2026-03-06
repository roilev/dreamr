import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ensureUser } from "@/lib/supabase/ensure-user";
import { ensureSceneOwnership } from "@/lib/supabase/ensure-scene-ownership";
import { rateLimitByIP, rateLimitResponse } from "@/lib/utils/rate-limit";
import { inngest } from "@/lib/inngest/client";
import type { RunStepRequest, PipelineStepName } from "@/lib/types/api";

const EVENT_MAP: Record<PipelineStepName, string> = {
  image_360: "dreamr/step.image360",
  video: "dreamr/step.video",
  upscale: "dreamr/step.upscale",
  depth: "dreamr/step.depth",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sceneId: string }> },
) {
  try {
    const rl = rateLimitByIP(req, { max: 10, windowMs: 60_000 });
    const blocked = rateLimitResponse(rl);
    if (blocked) return blocked;

    const { userId: clerkId } = await auth();
    if (!clerkId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await ensureUser(clerkId);
    const { sceneId } = await params;
    const body: RunStepRequest = await req.json().catch(() => ({ step: "image_360" }));

    const step = body.step;
    if (!EVENT_MAP[step]) {
      return NextResponse.json(
        { error: `Invalid step: ${step}. Valid: image_360, video, upscale, depth` },
        { status: 400 },
      );
    }

    const supabase = createAdminSupabase();
    const owns = await ensureSceneOwnership(supabase, sceneId, user.id);
    if (!owns)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const eventData: Record<string, unknown> = {
      sceneId,
      userId: user.id,
    };

    if (step === "video" && body.options?.veoModel) {
      eventData.veoModel = body.options.veoModel;
    }
    if (step === "depth" && body.options?.depthModel) {
      eventData.depthModel = body.options.depthModel;
    }
    if (body.options?.imageUrl) {
      eventData.imageUrl = body.options.imageUrl;
    }

    await inngest.send({
      name: EVENT_MAP[step] as never,
      data: eventData as never,
    });

    return NextResponse.json({ status: "step_started", step });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
