import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ensureUser } from "@/lib/supabase/ensure-user";
import { inngest } from "@/lib/inngest/client";
import type { GenerateWorldRequest } from "@/lib/types/api";

async function ensureSceneOwnership(supabase: ReturnType<typeof createAdminSupabase>, sceneId: string, userId: string) {
  const { data: scene } = await supabase.from("scenes").select("project_id").eq("id", sceneId).single();
  if (!scene) return false;
  const spaceId = (scene as { project_id: string }).project_id;
  const { data: space } = await supabase.from("projects").select("id").eq("id", spaceId).eq("user_id", userId).single();
  return !!space;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ sceneId: string }> }) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await ensureUser(clerkId);
    const { sceneId } = await params;
    const body: GenerateWorldRequest & { imageUrl?: string } = await req.json();

    if (!body.frameAssetId && !body.imageUrl) {
      return NextResponse.json({ error: "frameAssetId or imageUrl is required" }, { status: 400 });
    }

    const supabase = createAdminSupabase();
    const owns = await ensureSceneOwnership(supabase, sceneId, user.id);
    if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await inngest.send({
      name: "dreamr/world.generate",
      data: {
        sceneId,
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
