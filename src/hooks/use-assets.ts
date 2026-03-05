"use client";

import { useQuery } from "@tanstack/react-query";
import type { ListAssetsResponse } from "@/lib/types/api";

export function useAssets(sceneId: string) {
  return useQuery<ListAssetsResponse>({
    queryKey: ["assets", sceneId],
    queryFn: async () => {
      const res = await fetch(`/api/scenes/${sceneId}/assets`);
      if (!res.ok) throw new Error("Failed to fetch assets");
      return res.json();
    },
    enabled: !!sceneId,
  });
}
