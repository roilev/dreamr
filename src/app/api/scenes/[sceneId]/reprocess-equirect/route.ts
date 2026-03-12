import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ensureUser } from "@/lib/supabase/ensure-user";
import { ensureSceneOwnership } from "@/lib/supabase/ensure-scene-ownership";
import type { AssetRow } from "@/lib/supabase/types";
import sharp from "sharp";

const EQUIRECT_WIDTH = 4096;
const EQUIRECT_HEIGHT = 2048;
const ORIGINAL_ASPECT = 21 / 9;

export { reprocess as POST, reprocess as GET };

async function reprocess(
  _req: NextRequest,
  { params }: { params: Promise<{ sceneId: string }> },
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await ensureUser(clerkId);
    const { sceneId } = await params;
    const supabase = createAdminSupabase();

    const resolvedSceneId = await ensureSceneOwnership(
      supabase,
      sceneId,
      user.id,
    );
    if (!resolvedSceneId)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: asset } = await supabase
      .from("assets")
      .select("*")
      .eq("scene_id", resolvedSceneId)
      .eq("type", "equirect_image")
      .order("created_at", { ascending: false })
      .limit(1)
      .single() as { data: AssetRow | null };

    if (!asset)
      return NextResponse.json(
        { error: "No equirect asset found" },
        { status: 404 },
      );

    const { data: fileData, error: dlError } = await supabase.storage
      .from("generated-assets")
      .download(asset.storage_path);

    if (dlError || !fileData)
      return NextResponse.json(
        { error: "Failed to download asset" },
        { status: 500 },
      );

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const meta = await sharp(buffer).metadata();
    const srcW = meta.width ?? EQUIRECT_WIDTH;
    const srcH = meta.height ?? EQUIRECT_HEIGHT;
    const srcRatio = srcW / srcH;

    // Already correctly proportioned — nothing to fix
    if (Math.abs(srcRatio - 2.0) > 0.01) {
      return NextResponse.json({
        message: "Image is not 2:1, applying cover crop",
        originalSize: `${srcW}x${srcH}`,
      });
    }

    // Reverse the old fit:fill stretch by restoring original 21:9 proportions,
    // then apply cover-crop to get correct 2:1.
    const restoredHeight = Math.round(srcW / ORIGINAL_ASPECT);
    const restored = await sharp(buffer)
      .resize(srcW, restoredHeight, { fit: "fill" })
      .toBuffer();

    const reprocessed = await sharp(restored)
      .resize(EQUIRECT_WIDTH, EQUIRECT_HEIGHT, {
        fit: "cover",
        position: "centre",
      })
      .png()
      .toBuffer();

    const { error: uploadError } = await supabase.storage
      .from("generated-assets")
      .upload(asset.storage_path, reprocessed, {
        upsert: true,
        contentType: "image/png",
      });

    if (uploadError)
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 },
      );

    const { data: urlData } = supabase.storage
      .from("generated-assets")
      .getPublicUrl(asset.storage_path);

    await supabase
      .from("assets")
      .update({
        width: EQUIRECT_WIDTH,
        height: EQUIRECT_HEIGHT,
        file_size_bytes: reprocessed.length,
        public_url: urlData.publicUrl,
        metadata: { source: "reprocessed", original_size: `${srcW}x${srcH}` },
      } as never)
      .eq("id", asset.id);

    return NextResponse.json({
      message: "Reprocessed successfully",
      assetId: asset.id,
      originalSize: `${srcW}x${srcH}`,
      newSize: `${EQUIRECT_WIDTH}x${EQUIRECT_HEIGHT}`,
      publicUrl: `${urlData.publicUrl}?t=${Date.now()}`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
