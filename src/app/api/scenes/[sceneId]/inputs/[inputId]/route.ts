import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ensureUser } from "@/lib/supabase/ensure-user";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sceneId: string; inputId: string }> },
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await ensureUser(clerkId);
    const { sceneId, inputId } = await params;
    const supabase = createAdminSupabase();

    const { data: scene } = await supabase.from("scenes").select("project_id").eq("id", sceneId).single();
    if (!scene) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const projectId = (scene as { project_id: string }).project_id;
    const { data: space } = await supabase.from("projects").select("id").eq("id", projectId).eq("user_id", user.id).single();
    if (!space) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { error } = await supabase
      .from("scene_inputs")
      .delete()
      .eq("id", inputId)
      .eq("scene_id", sceneId);

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
