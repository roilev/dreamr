import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ensureUser } from "@/lib/supabase/ensure-user";
import { isAdminServer } from "@/lib/clerk/check-role";
import { idColumn } from "@/lib/ids";
import type { UpdateSpaceRequest } from "@/lib/types/api";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ spaceId: string }> }) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await ensureUser(clerkId);
    const { spaceId } = await params;
    const supabase = createAdminSupabase();
    const admin = await isAdminServer();

    let query = supabase.from("spaces").select("*").eq(idColumn(spaceId) as never, spaceId);
    if (!admin) query = query.eq("user_id", user.id);

    const { data, error } = await query.single();
    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ spaceId: string }> }) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await ensureUser(clerkId);
    const { spaceId } = await params;
    const body: UpdateSpaceRequest = await req.json();
    const supabase = createAdminSupabase();

    const { name, description } = body as { name?: string; description?: string };
    const updates = {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("spaces")
      .update(updates as never)
      .eq(idColumn(spaceId) as never, spaceId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ spaceId: string }> }) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await ensureUser(clerkId);
    const { spaceId } = await params;
    const supabase = createAdminSupabase();
    const { error } = await supabase
      .from("spaces")
      .delete()
      .eq(idColumn(spaceId) as never, spaceId)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
