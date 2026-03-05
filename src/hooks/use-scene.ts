"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CreateSceneRequest,
  CreateSceneResponse,
  GetSceneResponse,
  UpdateSceneRequest,
} from "@/lib/types/api";

export function useScene(sceneId: string) {
  return useQuery<GetSceneResponse>({
    queryKey: ["scene", sceneId],
    queryFn: async () => {
      const res = await fetch(`/api/scenes/${sceneId}`);
      if (!res.ok) throw new Error("Failed to fetch scene");
      return res.json();
    },
    enabled: !!sceneId,
  });
}

export function useCreateScene(spaceId: string) {
  const queryClient = useQueryClient();

  return useMutation<CreateSceneResponse, Error, CreateSceneRequest>({
    mutationFn: async (data) => {
      const res = await fetch(`/api/spaces/${spaceId}/scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create scene");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenes", spaceId] });
    },
  });
}

export function useUpdateScene(sceneId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, UpdateSceneRequest>({
    mutationFn: async (data) => {
      const res = await fetch(`/api/scenes/${sceneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update scene");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scene", sceneId] });
    },
  });
}
