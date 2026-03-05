import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ensureUser } from "@/lib/supabase/ensure-user";
import { SUPABASE_BUCKETS } from "@/lib/utils/constants";

async function ensureSceneOwnership(
  supabase: ReturnType<typeof createAdminSupabase>,
  sceneId: string,
  userId: string,
) {
  const { data: scene } = await supabase.from("scenes").select("project_id").eq("id", sceneId).single();
  if (!scene) return false;
  const spaceId = (scene as { project_id: string }).project_id;
  const { data: space } = await supabase.from("projects").select("id").eq("id", spaceId).eq("user_id", userId).single();
  return !!space;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sceneId: string }> },
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await ensureUser(clerkId);
    const { sceneId } = await params;
    const supabase = createAdminSupabase();

    const owns = await ensureSceneOwnership(supabase, sceneId, user.id);
    if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("frame") as File | null;
    if (!file) return NextResponse.json({ error: "No frame provided" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `${user.id}/${sceneId}/captured-frame-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_BUCKETS.GENERATED_ASSETS)
      .upload(storagePath, buffer, {
        upsert: true,
        contentType: "image/png",
      });

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from(SUPABASE_BUCKETS.GENERATED_ASSETS)
      .getPublicUrl(storagePath);

    return NextResponse.json({ publicUrl: urlData.publicUrl, storagePath });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
