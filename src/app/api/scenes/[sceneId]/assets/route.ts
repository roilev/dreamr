import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ensureUser } from "@/lib/supabase/ensure-user";

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

    const owns = await ensureSceneOwnership(supabase, sceneId, user.id);
    if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("scene_id", sceneId)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
