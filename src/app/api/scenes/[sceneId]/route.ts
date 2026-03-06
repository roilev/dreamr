import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ensureUser } from "@/lib/supabase/ensure-user";
import { ensureSceneOwnership } from "@/lib/supabase/ensure-scene-ownership";
import { isAdminServer } from "@/lib/clerk/check-role";
import type { UpdateSceneRequest } from "@/lib/types/api";

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
    if (!owns) {
      const admin = await isAdminServer();
      if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

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

    const { name, prompt, description } = body as { name?: string; prompt?: string; description?: string };
    const updates = {
      ...(name !== undefined && { name }),
      ...(prompt !== undefined && { prompt }),
      ...(description !== undefined && { description }),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("scenes")
      .update(updates as never)
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
