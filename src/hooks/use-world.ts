"use client";

import { useQuery } from "@tanstack/react-query";
import { createBrowserSupabase } from "@/lib/supabase/client";
import type { SceneWorldRow } from "@/lib/supabase/types";

export interface WorldWithAssets extends SceneWorldRow {
  splat100kUrl: string | null;
  splat500kUrl: string | null;
  splatFullUrl: string | null;
  colliderUrl: string | null;
}

export function useSceneWorld(sceneId: string | undefined) {
  return useQuery<WorldWithAssets | null>({
    queryKey: ["scene-world", sceneId],
    queryFn: async () => {
      if (!sceneId) return null;
      const supabase = createBrowserSupabase();

      const { data: world, error } = await supabase
        .from("scene_worlds")
        .select("*")
        .eq("scene_id", sceneId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle() as { data: SceneWorldRow | null; error: unknown };

      if (error || !world) return null;

      const assetIds = [
        world.splat_100k_asset_id,
        world.splat_500k_asset_id,
        world.splat_full_asset_id,
        world.collider_asset_id,
      ].filter(Boolean) as string[];

      if (assetIds.length === 0) return null;

      const { data: assets } = await supabase
        .from("assets")
        .select("id, public_url")
        .in("id", assetIds) as { data: { id: string; public_url: string | null }[] | null };

      const assetMap = new Map(
        (assets ?? []).map((a) => [a.id, a.public_url]),
      );

      return {
        ...world,
        splat100kUrl: assetMap.get(world.splat_100k_asset_id ?? "") ?? null,
        splat500kUrl: assetMap.get(world.splat_500k_asset_id ?? "") ?? null,
        splatFullUrl: assetMap.get(world.splat_full_asset_id ?? "") ?? null,
        colliderUrl: assetMap.get(world.collider_asset_id ?? "") ?? null,
      };
    },
    enabled: !!sceneId,
  });
}

export function useWorldGenerationStatus(sceneId: string | undefined) {
  return useQuery<{ status: string; worldId: string | null } | null>({
    queryKey: ["world-gen-status", sceneId],
    queryFn: async () => {
      if (!sceneId) return null;
      const supabase = createBrowserSupabase();

      const { data, error } = await supabase
        .from("scene_worlds")
        .select("id, status, marble_operation_id")
        .eq("scene_id", sceneId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle() as { data: { id: string; status: string; marble_operation_id: string | null } | null; error: unknown };

      if (error || !data) return null;
      return { status: data.status, worldId: data.id };
    },
    enabled: !!sceneId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === "pending" || data?.status === "running") return 3000;
      return false;
    },
  });
}
