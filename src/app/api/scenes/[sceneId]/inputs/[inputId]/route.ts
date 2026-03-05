import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ensureUser } from "@/lib/supabase/ensure-user";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sceneId: string; inputId: string }> },
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await ensureUser(clerkId);
    const { inputId } = await params;
    const supabase = createAdminSupabase();

    const { error } = await supabase
      .from("scene_inputs")
      .delete()
      .eq("id", inputId);

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
