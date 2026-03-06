import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ensureUser } from "@/lib/supabase/ensure-user";
import { ensureSceneOwnership } from "@/lib/supabase/ensure-scene-ownership";
import type { AssetRow, PipelineJobRow, SceneWorldRow } from "@/lib/supabase/types";

interface GenerationEvent {
  id: string;
  type: "job" | "world";
  step?: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  assets?: AssetRow[];
  error?: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sceneId: string }> },
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await ensureUser(clerkId);
    const { sceneId } = await params;
    const supabase = createAdminSupabase();

    const resolvedSceneId = await ensureSceneOwnership(supabase, sceneId, user.id);
    if (!resolvedSceneId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [jobsResult, assetsResult, worldsResult] = await Promise.all([
      supabase
        .from("pipeline_jobs")
        .select("*")
        .eq("scene_id", resolvedSceneId)
        .order("created_at", { ascending: true }),
      supabase
        .from("assets")
        .select("*")
        .eq("scene_id", resolvedSceneId)
        .order("created_at", { ascending: true }),
      supabase
        .from("scene_worlds")
        .select("*")
        .eq("scene_id", resolvedSceneId)
        .order("created_at", { ascending: true }),
    ]);

    const jobs = (jobsResult.data ?? []) as PipelineJobRow[];
    const assets = (assetsResult.data ?? []) as AssetRow[];
    const worlds = (worldsResult.data ?? []) as SceneWorldRow[];

    const assetsByJobId = new Map<string, AssetRow[]>();
    for (const asset of assets) {
      if (!asset.job_id) continue;
      const list = assetsByJobId.get(asset.job_id) ?? [];
      list.push(asset);
      assetsByJobId.set(asset.job_id, list);
    }

    const events: GenerationEvent[] = [];

    for (const job of jobs) {
      events.push({
        id: job.id,
        type: "job",
        step: job.step,
        status: job.status,
        createdAt: job.created_at,
        completedAt: job.completed_at ?? undefined,
        assets: assetsByJobId.get(job.id),
        error: job.error_message ?? undefined,
      });
    }

    for (const world of worlds) {
      events.push({
        id: world.id,
        type: "world",
        step: "world",
        status: world.status,
        createdAt: world.created_at,
        completedAt: world.completed_at ?? undefined,
      });
    }

    events.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    return NextResponse.json(events);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
