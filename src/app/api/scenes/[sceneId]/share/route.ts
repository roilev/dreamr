import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ensureUser } from "@/lib/supabase/ensure-user";
import { ensureSceneOwnership } from "@/lib/supabase/ensure-scene-ownership";
import { rateLimitByIP, rateLimitResponse } from "@/lib/utils/rate-limit";
import { randomUUID } from "crypto";

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
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

    const resolvedSceneId = await ensureSceneOwnership(supabase, sceneId, user.id);
    if (!resolvedSceneId)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: scene } = await supabase
      .from("scenes")
      .select("share_token")
      .eq("id", resolvedSceneId)
      .single();

    if (!scene)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const existing = (scene as { share_token: string | null }).share_token;
    if (existing) {
      return NextResponse.json({
        shareUrl: `${getAppUrl()}/share/${existing}`,
        shareToken: existing,
      });
    }

    const shareToken = randomUUID().replace(/-/g, "").slice(0, 12);

    const { error } = await supabase
      .from("scenes")
      .update({ share_token: shareToken } as never)
      .eq("id", resolvedSceneId);

    if (error)
      return NextResponse.json(
        { error: "Failed to create share link" },
        { status: 500 },
      );

    return NextResponse.json({
      shareUrl: `${getAppUrl()}/share/${shareToken}`,
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

    const resolvedSceneId = await ensureSceneOwnership(supabase, sceneId, user.id);
    if (!resolvedSceneId)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { error } = await supabase
      .from("scenes")
      .update({ share_token: null } as never)
      .eq("id", resolvedSceneId);

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
