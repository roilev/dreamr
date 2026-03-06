"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useQueryClient } from "@tanstack/react-query";
import { isUUID } from "@/lib/ids";
import type { PipelineJobRow } from "@/lib/supabase/types";

/**
 * Subscribes to real-time pipeline job updates for a scene.
 * Fetches initial state, then listens for INSERT/UPDATE via Supabase Realtime.
 * Also watches scene status to auto-refresh data when generation completes.
 * Accepts UUID or short_id — resolves to UUID for direct DB queries.
 */
export function usePipelineSubscription(sceneId: string) {
  const { setJobs, updateJob } = usePipelineStore();
  const queryClient = useQueryClient();
  const refreshedRef = useRef<Set<string>>(new Set());
  const [resolvedId, setResolvedId] = useState<string | null>(
    isUUID(sceneId) ? sceneId : null,
  );

  const refreshScene = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["scene", sceneId] });
  }, [queryClient, sceneId]);

  useEffect(() => {
    if (!sceneId || isUUID(sceneId)) return;
    let cancelled = false;
    fetch(`/api/scenes/${sceneId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((scene) => {
        if (!cancelled && scene?.id) setResolvedId(scene.id);
      });
    return () => { cancelled = true; };
  }, [sceneId]);

  useEffect(() => {
    if (!resolvedId) return;
    refreshedRef.current.clear();

    const supabase = createBrowserSupabase();

    supabase
      .from("pipeline_jobs")
      .select("*")
      .eq("scene_id", resolvedId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setJobs(data as PipelineJobRow[]);
      });

    const channel = supabase
      .channel(`pipeline-${resolvedId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pipeline_jobs",
          filter: `scene_id=eq.${resolvedId}`,
        },
        (payload) => {
          if (
            payload.eventType === "INSERT" ||
            payload.eventType === "UPDATE"
          ) {
            const job = payload.new as PipelineJobRow;
            updateJob(job);

            if (
              (job.status === "completed" || job.status === "failed") &&
              !refreshedRef.current.has(job.id)
            ) {
              refreshedRef.current.add(job.id);
              refreshScene();
            }
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "scenes",
          filter: `id=eq.${resolvedId}`,
        },
        (payload) => {
          const newStatus = (payload.new as { status?: string }).status;
          if (newStatus === "completed" || newStatus === "failed") {
            refreshScene();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [resolvedId, setJobs, updateJob, refreshScene]);
}
