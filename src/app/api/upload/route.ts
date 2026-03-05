import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ensureUser } from "@/lib/supabase/ensure-user";
import type { UploadRequest } from "@/lib/types/api";

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await ensureUser(clerkId);
    const body: UploadRequest = await req.json();
    const supabase = createAdminSupabase();

    const storagePath = body.path;
    const { data, error } = await supabase.storage
      .from(body.bucket)
      .createSignedUploadUrl(storagePath);

    if (error || !data) return NextResponse.json({ error: error?.message ?? "Upload failed" }, { status: 500 });

    return NextResponse.json({
      signedUrl: data.signedUrl,
      storagePath,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
