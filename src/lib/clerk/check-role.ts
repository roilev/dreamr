import { auth, currentUser } from "@clerk/nextjs/server";
import type { UserPublicMetadata } from "./types";

/**
 * Server-side role check.
 *
 * 1. Tries sessionClaims.metadata.role (fast, no API call — requires session
 *    token customization in Clerk Dashboard).
 * 2. Falls back to currentUser().publicMetadata.role (makes one Clerk API call).
 */
export async function checkRole(role: string): Promise<boolean> {
  const { sessionClaims } = await auth();

  const claimsRole = (sessionClaims as { metadata?: UserPublicMetadata } | null)?.metadata?.role;
  if (claimsRole) return claimsRole === role;

  const user = await currentUser();
  if (!user) return false;
  return (user.publicMetadata as UserPublicMetadata)?.role === role;
}

export async function isAdminServer(): Promise<boolean> {
  return checkRole("admin");
}
