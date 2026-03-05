"use client";

import { useEffect, useCallback, useRef } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useQueryClient } from "@tanstack/react-query";
import type { PipelineJobRow } from "@/lib/supabase/types";

/**
 * Subscribes to real-time pipeline job updates for a scene.
 * Fetches initial state, then listens for INSERT/UPDATE via Supabase Realtime.
 * Also watches scene status to auto-refresh data when generation completes.
 */
export function usePipelineSubscription(sceneId: string) {
  const { setJobs, updateJob } = usePipelineStore();
  const queryClient = useQueryClient();
  const refreshedRef = useRef<Set<string>>(new Set());

  const refreshScene = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["scene", sceneId] });
  }, [queryClient, sceneId]);

  useEffect(() => {
    if (!sceneId) return;
    refreshedRef.current.clear();

    const supabase = createBrowserSupabase();

    supabase
      .from("pipeline_jobs")
      .select("*")
      .eq("scene_id", sceneId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setJobs(data as PipelineJobRow[]);
      });

    const channel = supabase
      .channel(`pipeline-${sceneId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pipeline_jobs",
          filter: `scene_id=eq.${sceneId}`,
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
          filter: `id=eq.${sceneId}`,
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
  }, [sceneId, setJobs, updateJob, refreshScene]);
}
