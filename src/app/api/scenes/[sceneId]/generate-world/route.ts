import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ensureUser } from "@/lib/supabase/ensure-user";
import { ensureSceneOwnership } from "@/lib/supabase/ensure-scene-ownership";
import { isAdminServer } from "@/lib/clerk/check-role";
import { idColumn } from "@/lib/ids";
import { rateLimitByIP, rateLimitResponse } from "@/lib/utils/rate-limit";
import { inngest } from "@/lib/inngest/client";
import type { GenerateWorldRequest } from "@/lib/types/api";

export async function POST(req: NextRequest, { params }: { params: Promise<{ sceneId: string }> }) {
  try {
    const rl = rateLimitByIP(req, { max: 10, windowMs: 60_000 });
    const blocked = rateLimitResponse(rl);
    if (blocked) return blocked;

    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await ensureUser(clerkId);
    const { sceneId } = await params;
    const body: GenerateWorldRequest & { imageUrl?: string } = await req.json();

    if (!body.frameAssetId && !body.imageUrl) {
      return NextResponse.json({ error: "frameAssetId or imageUrl is required" }, { status: 400 });
    }

    const supabase = createAdminSupabase();
    let resolvedSceneId = await ensureSceneOwnership(supabase, sceneId, user.id);
    if (!resolvedSceneId) {
      const admin = await isAdminServer();
      if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const { data: scene } = await supabase.from("scenes").select("id").eq(idColumn(sceneId) as never, sceneId).single();
      if (!scene) return NextResponse.json({ error: "Not found" }, { status: 404 });
      resolvedSceneId = (scene as { id: string }).id;
    }

    await inngest.send({
      name: "dreamr/world.generate",
      data: {
        sceneId: resolvedSceneId,
        userId: user.id,
        frameAssetId: body.frameAssetId ?? null,
        ...(body.imageUrl && { imageUrl: body.imageUrl }),
      },
    });

    return NextResponse.json({ status: "world_generation_started" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
