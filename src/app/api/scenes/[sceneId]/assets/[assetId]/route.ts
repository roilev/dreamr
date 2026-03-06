import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ensureUser } from "@/lib/supabase/ensure-user";
import { ensureSceneOwnership } from "@/lib/supabase/ensure-scene-ownership";
import type { AssetRow } from "@/lib/supabase/types";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sceneId: string; assetId: string }> },
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await ensureUser(clerkId);
    const { sceneId, assetId } = await params;
    const supabase = createAdminSupabase();

    const owns = await ensureSceneOwnership(supabase, sceneId, user.id);
    if (!owns) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: assetData } = await supabase
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .eq("scene_id", sceneId)
      .single();

    const asset = assetData as AssetRow | null;
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    if (asset.storage_path) {
      await supabase.storage
        .from("generated-assets")
        .remove([asset.storage_path]);
    }

    const { error } = await supabase
      .from("assets")
      .delete()
      .eq("id", assetId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete asset" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
