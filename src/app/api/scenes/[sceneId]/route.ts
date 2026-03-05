import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ensureUser } from "@/lib/supabase/ensure-user";
import type { UpdateSceneRequest } from "@/lib/types/api";

async function ensureSceneOwnership(supabase: ReturnType<typeof createAdminSupabase>, sceneId: string, userId: string) {
  const { data: scene } = await supabase.from("scenes").select("project_id").eq("id", sceneId).single();
  if (!scene) return false;
  const spaceId = (scene as { project_id: string }).project_id;
  const { data: space } = await supabase.from("projects").select("id").eq("id", spaceId).eq("user_id", userId).single();
  return !!space;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ sceneId: string }> }) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await ensureUser(clerkId);
    const { sceneId } = await params;
    const supabase = createAdminSupabase();

    const { data: scene, error } = await supabase.from("scenes").select("*").eq("id", sceneId).single();
    if (error || !scene) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const owns = await ensureSceneOwnership(supabase, sceneId, user.id);
    if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [inputs, jobs, assets, worlds] = await Promise.all([
      supabase.from("scene_inputs").select("*").eq("scene_id", sceneId).order("sort_order"),
      supabase.from("pipeline_jobs").select("*").eq("scene_id", sceneId).order("created_at"),
      supabase.from("assets").select("*").eq("scene_id", sceneId).order("created_at"),
      supabase.from("scene_worlds").select("*").eq("scene_id", sceneId).order("created_at"),
    ]);

    return NextResponse.json({
      ...(scene as Record<string, unknown>),
      inputs: inputs.data ?? [],
      jobs: jobs.data ?? [],
      assets: assets.data ?? [],
      worlds: worlds.data ?? [],
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ sceneId: string }> }) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await ensureUser(clerkId);
    const { sceneId } = await params;
    const body: UpdateSceneRequest = await req.json();
    const supabase = createAdminSupabase();

    const owns = await ensureSceneOwnership(supabase, sceneId, user.id);
    if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data, error } = await supabase
      .from("scenes")
      .update({ ...body, updated_at: new Date().toISOString() } as never)
      .eq("id", sceneId)
      .select()
      .single();

    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ sceneId: string }> }) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await ensureUser(clerkId);
    const { sceneId } = await params;
    const supabase = createAdminSupabase();

    const owns = await ensureSceneOwnership(supabase, sceneId, user.id);
    if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { error } = await supabase.from("scenes").delete().eq("id", sceneId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
