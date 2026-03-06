import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    let body: Record<string, unknown>;

    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("CLERK_WEBHOOK_SECRET is not configured");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
    }

    const wh = new Webhook(webhookSecret);
    body = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as Record<string, unknown>;

    const eventType = body.type as string;

    if (eventType === "user.created" || eventType === "user.updated") {
      const data = body.data as Record<string, unknown>;
      const clerkId = data.id as string;
      const email_addresses = data.email_addresses as Array<{ email_address: string }> | undefined;
      const first_name = data.first_name as string | null;
      const last_name = data.last_name as string | null;
      const image_url = data.image_url as string | null;
      const email = email_addresses?.[0]?.email_address ?? null;
      const displayName = [first_name, last_name].filter(Boolean).join(" ") || null;

      const supabase = createAdminSupabase();

      const { data: existing } = await supabase.from("users").select("id").eq("clerk_id", clerkId).single();

      if (existing) {
        await supabase
          .from("users")
          .update({ email, display_name: displayName, avatar_url: image_url ?? null, updated_at: new Date().toISOString() } as never)
          .eq("clerk_id", clerkId);
      } else {
        await supabase
          .from("users")
          .insert({ clerk_id: clerkId, email, display_name: displayName, avatar_url: image_url ?? null } as never);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
