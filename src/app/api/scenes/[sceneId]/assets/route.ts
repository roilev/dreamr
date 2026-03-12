import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ensureUser } from "@/lib/supabase/ensure-user";
import { ensureSceneOwnership } from "@/lib/supabase/ensure-scene-ownership";
import type { AssetType } from "@/lib/supabase/types";

const ALLOWED_CLIENT_ASSET_TYPES: AssetType[] = ["equirect_image"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ sceneId: string }> }) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await ensureUser(clerkId);
    const { sceneId } = await params;
    const supabase = createAdminSupabase();

    const resolvedSceneId = await ensureSceneOwnership(supabase, sceneId, user.id);
    if (!resolvedSceneId) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("scene_id", resolvedSceneId)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ sceneId: string }> }) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await ensureUser(clerkId);
    const { sceneId } = await params;
    const body = await req.json();
    const supabase = createAdminSupabase();

    const resolvedSceneId = await ensureSceneOwnership(supabase, sceneId, user.id);
    if (!resolvedSceneId) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!ALLOWED_CLIENT_ASSET_TYPES.includes(body.type)) {
      return NextResponse.json({ error: "Asset type not allowed" }, { status: 400 });
    }

    const bucket = "generated-assets";
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(body.storage_path);

    const { data, error } = await supabase
      .from("assets")
      .insert({
        scene_id: resolvedSceneId,
        job_id: null,
        type: body.type,
        storage_path: body.storage_path,
        public_url: urlData.publicUrl,
        file_size_bytes: body.file_size_bytes ?? null,
        width: body.width ?? null,
        height: body.height ?? null,
        duration_seconds: null,
        metadata: { source: "user_upload" },
      } as never)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
