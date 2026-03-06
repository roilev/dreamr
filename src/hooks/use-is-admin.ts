"use client";

import { useUser } from "@clerk/nextjs";
import { useAppStore } from "@/lib/stores/app-store";
import type { UserPublicMetadata } from "@/lib/clerk/types";

/**
 * Client-side admin check using Clerk publicMetadata.role + admin view toggle.
 *
 * - `hasAdminRole` — true if the Clerk user has role === "admin" in publicMetadata
 * - `adminMode`    — true if the user has toggled admin view on (persisted in localStorage)
 * - `isAdmin`      — true when both conditions are met (has role AND toggle is on)
 */
export function useIsAdmin() {
  const { user, isLoaded } = useUser();
  const { adminMode } = useAppStore();

  const role = (user?.publicMetadata as UserPublicMetadata | undefined)?.role;
  const hasAdminRole = role === "admin";

  return {
    hasAdminRole,
    adminMode,
    isAdmin: hasAdminRole && adminMode,
    isLoading: !isLoaded,
  };
}
