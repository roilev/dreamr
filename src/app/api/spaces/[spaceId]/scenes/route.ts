import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ensureUser } from "@/lib/supabase/ensure-user";
import type { CreateSceneRequest } from "@/lib/types/api";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ spaceId: string }> }) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await ensureUser(clerkId);
    const { spaceId } = await params;
    const supabase = createAdminSupabase();

    const { data: space } = await supabase.from("projects").select("id").eq("id", spaceId).eq("user_id", user.id).single();
    if (!space) return NextResponse.json({ error: "Space not found" }, { status: 404 });

    const { data, error } = await supabase
      .from("scenes")
      .select("*")
      .eq("project_id", spaceId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ spaceId: string }> }) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await ensureUser(clerkId);
    const { spaceId } = await params;
    const body: CreateSceneRequest = await req.json();
    const supabase = createAdminSupabase();

    const { data: space } = await supabase.from("projects").select("id").eq("id", spaceId).eq("user_id", user.id).single();
    if (!space) return NextResponse.json({ error: "Space not found" }, { status: 404 });

    const { data, error } = await supabase
      .from("scenes")
      .insert({
        project_id: spaceId,
        name: body.name || "Untitled Scene",
        prompt: body.prompt ?? null,
        status: "draft",
        current_step: null,
        thumbnail_url: null,
      } as never)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
