"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { Shield } from "lucide-react";
import { useAppStore } from "@/lib/stores/app-store";
import type { UserPublicMetadata } from "@/lib/clerk/types";

export function CustomUserButton() {
  const { user } = useUser();
  const role = (user?.publicMetadata as UserPublicMetadata | undefined)?.role;
  const isAdmin = role === "admin";
  const { adminMode, toggleAdminMode } = useAppStore();

  return (
    <UserButton appearance={{ elements: { avatarBox: "w-7 h-7" } }}>
      {isAdmin && (
        <UserButton.MenuItems>
          <UserButton.Action
            label={adminMode ? "Switch to Standard View" : "Switch to Admin View"}
            labelIcon={<Shield size={14} />}
            onClick={toggleAdminMode}
          />
        </UserButton.MenuItems>
      )}
    </UserButton>
  );
}
