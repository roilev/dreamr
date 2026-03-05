import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ensureUser } from "@/lib/supabase/ensure-user";
import { rateLimitByIP, rateLimitResponse } from "@/lib/utils/rate-limit";
import { randomUUID } from "crypto";

async function ensureSceneOwnership(
  supabase: ReturnType<typeof createAdminSupabase>,
  sceneId: string,
  userId: string,
) {
  const { data: scene } = await supabase
    .from("scenes")
    .select("id, space_id")
    .eq("id", sceneId)
    .single();

  if (!scene) return false;

  const spaceId = (scene as { space_id: string }).space_id;
  const { data: space } = await supabase
    .from("spaces")
    .select("id")
    .eq("id", spaceId)
    .eq("user_id", userId)
    .single();

  return !!space;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sceneId: string }> },
) {
  try {
    const rl = rateLimitByIP(request, { max: 20, windowMs: 60_000 });
    const blocked = rateLimitResponse(rl);
    if (blocked) return blocked;

    const { userId: clerkId } = await auth();
    if (!clerkId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await ensureUser(clerkId);
    const { sceneId } = await params;
    const supabase = createAdminSupabase();

    const owns = await ensureSceneOwnership(supabase, sceneId, user.id);
    if (!owns)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: scene } = await supabase
      .from("scenes")
      .select("share_token")
      .eq("id", sceneId)
      .single();

    if (!scene)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const existing = (scene as { share_token: string | null }).share_token;
    if (existing) {
      return NextResponse.json({
        shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/share/${existing}`,
        shareToken: existing,
      });
    }

    const shareToken = randomUUID().replace(/-/g, "").slice(0, 12);

    const { error } = await supabase
      .from("scenes")
      .update({ share_token: shareToken } as never)
      .eq("id", sceneId);

    if (error)
      return NextResponse.json(
        { error: "Failed to create share link" },
        { status: 500 },
      );

    return NextResponse.json({
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/share/${shareToken}`,
      shareToken,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sceneId: string }> },
) {
  try {
    const rl = rateLimitByIP(request, { max: 20, windowMs: 60_000 });
    const blocked = rateLimitResponse(rl);
    if (blocked) return blocked;

    const { userId: clerkId } = await auth();
    if (!clerkId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await ensureUser(clerkId);
    const { sceneId } = await params;
    const supabase = createAdminSupabase();

    const owns = await ensureSceneOwnership(supabase, sceneId, user.id);
    if (!owns)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { error } = await supabase
      .from("scenes")
      .update({ share_token: null } as never)
      .eq("id", sceneId);

    if (error)
      return NextResponse.json(
        { error: "Failed to revoke share link" },
        { status: 500 },
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
