"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

export function useDeleteAsset(sceneId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (assetId) => {
      const res = await fetch(
        `/api/scenes/${sceneId}/assets/${assetId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete asset");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets", sceneId] });
      queryClient.invalidateQueries({ queryKey: ["scene", sceneId] });
    },
  });
}

export function useDeleteAssets(sceneId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string[]>({
    mutationFn: async (assetIds) => {
      const results = await Promise.allSettled(
        assetIds.map((id) =>
          fetch(`/api/scenes/${sceneId}/assets/${id}`, { method: "DELETE" }),
        ),
      );
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        throw new Error(`Failed to delete ${failures.length} asset(s)`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets", sceneId] });
      queryClient.invalidateQueries({ queryKey: ["scene", sceneId] });
    },
  });
}

export interface GenerationEvent {
  id: string;
  type: "job" | "asset" | "world";
  step?: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  assets?: ListAssetsResponse;
  error?: string;
}

export type GenerationHistoryResponse = GenerationEvent[];

export function useGenerationHistory(sceneId: string) {
  return useQuery<GenerationHistoryResponse>({
    queryKey: ["generation-history", sceneId],
    queryFn: async () => {
      const res = await fetch(`/api/scenes/${sceneId}/history`);
      if (!res.ok) throw new Error("Failed to fetch generation history");
      return res.json();
    },
    enabled: !!sceneId,
  });
}
