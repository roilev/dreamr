import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ensureUser } from "@/lib/supabase/ensure-user";
import { isAdminServer } from "@/lib/clerk/check-role";
import type { CreateSpaceRequest } from "@/lib/types/api";

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await ensureUser(clerkId);
    const supabase = createAdminSupabase();

    const wantAll = req.nextUrl.searchParams.get("all") === "true";
    const admin = wantAll ? await isAdminServer() : false;

    if (wantAll && admin) {
      const { data: allSpaces, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const userIds = [...new Set((allSpaces ?? []).map((s: Record<string, unknown>) => s.user_id as string))];
      const { data: users } = await supabase
        .from("users")
        .select("id, email, display_name")
        .in("id", userIds) as { data: { id: string; email: string | null; display_name: string | null }[] | null };

      const userMap = new Map((users ?? []).map((u) => [u.id, u]));

      const enriched = (allSpaces ?? []).map((space: Record<string, unknown>) => {
        const owner = userMap.get(space.user_id as string);
        return {
          ...space,
          owner: owner ? { email: owner.email, display_name: owner.display_name } : null,
        };
      });
      return NextResponse.json(enriched);
    }

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await ensureUser(clerkId);
    const body: CreateSpaceRequest = await req.json();
    if (!body.name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("projects")
      .insert({ user_id: user.id, name: body.name, description: body.description ?? null, thumbnail_url: null } as never)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
