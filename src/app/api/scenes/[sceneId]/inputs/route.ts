import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ensureUser } from "@/lib/supabase/ensure-user";
import { ensureSceneOwnership } from "@/lib/supabase/ensure-scene-ownership";
import type { AddSceneInputRequest } from "@/lib/types/api";

export async function POST(req: NextRequest, { params }: { params: Promise<{ sceneId: string }> }) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await ensureUser(clerkId);
    const { sceneId } = await params;
    const body: AddSceneInputRequest = await req.json();
    const supabase = createAdminSupabase();

    const owns = await ensureSceneOwnership(supabase, sceneId, user.id);
    if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data, error } = await supabase
      .from("scene_inputs")
      .insert({
        scene_id: sceneId,
        type: body.type,
        content: body.content ?? null,
        storage_path: body.storage_path ?? null,
        position_x: body.position_x ?? 0,
        position_y: body.position_y ?? 0,
        position_z: body.position_z ?? 0,
        sort_order: body.sort_order ?? 0,
      } as never)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
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
    const body: { id: string; position_x?: number; position_y?: number; position_z?: number }[] = await req.json();
    const supabase = createAdminSupabase();

    const owns = await ensureSceneOwnership(supabase, sceneId, user.id);
    if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updates = await Promise.all(
      body.map(async (item) => {
        const patch: Record<string, number> = {};
        if (item.position_x !== undefined) patch.position_x = item.position_x;
        if (item.position_y !== undefined) patch.position_y = item.position_y;
        if (item.position_z !== undefined) patch.position_z = item.position_z;

        const { error } = await supabase
          .from("scene_inputs")
          .update(patch as never)
          .eq("id", item.id)
          .eq("scene_id", sceneId);

        return { id: item.id, error: error?.message };
      }),
    );

    const failed = updates.filter((u) => u.error);
    if (failed.length) {
      return NextResponse.json({ error: "Some updates failed", details: failed }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
