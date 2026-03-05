import { createAdminSupabase } from "./admin";
import type { UserRow } from "./types";

/**
 * Gets or creates a user row in the DB from Clerk auth claims.
 * This replaces the Clerk webhook for local dev — on first API call
 * the user is auto-provisioned.
 */
export async function ensureUser(clerkUserId: string, email?: string | null, displayName?: string | null, avatarUrl?: string | null): Promise<UserRow> {
  const supabase = createAdminSupabase();

  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("clerk_id", clerkUserId)
    .single();

  if (existing) return existing as UserRow;

  const { data: created, error } = await supabase
    .from("users")
    .insert({
      clerk_id: clerkUserId,
      email: email ?? null,
      display_name: displayName ?? null,
      avatar_url: avatarUrl ?? null,
    } as never)
    .select()
    .single();

  if (error || !created) {
    throw new Error(`Failed to create user: ${error?.message ?? "unknown"}`);
  }

  return created as UserRow;
}
