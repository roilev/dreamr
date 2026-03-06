import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ensureUser } from "@/lib/supabase/ensure-user";
import { rateLimitByIP, rateLimitResponse } from "@/lib/utils/rate-limit";
import type { UploadRequest } from "@/lib/types/api";

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimitByIP(req, { max: 30, windowMs: 60_000 });
    const blocked = rateLimitResponse(rl);
    if (blocked) return blocked;

    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await ensureUser(clerkId);
    const body: UploadRequest = await req.json();

    const ALLOWED_BUCKETS = ["scene-inputs", "generated-assets"];
    if (!ALLOWED_BUCKETS.includes(body.bucket)) {
      return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
    }

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
