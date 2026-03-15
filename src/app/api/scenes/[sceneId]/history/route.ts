import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ensureUser } from "@/lib/supabase/ensure-user";
import { ensureSceneOwnership } from "@/lib/supabase/ensure-scene-ownership";
import { isAdminServer } from "@/lib/clerk/check-role";
import { idColumn } from "@/lib/ids";
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
  provider?: string;
  modelId?: string;
  inputMetadata?: Record<string, unknown>;
  outputMetadata?: Record<string, unknown>;
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

    let resolvedSceneId = await ensureSceneOwnership(supabase, sceneId, user.id);
    if (!resolvedSceneId) {
      const admin = await isAdminServer();
      if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const { data: scene } = await supabase.from("scenes").select("id").eq(idColumn(sceneId) as never, sceneId).single();
      if (!scene) return NextResponse.json({ error: "Not found" }, { status: 404 });
      resolvedSceneId = (scene as { id: string }).id;
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
        provider: job.provider ?? undefined,
        modelId: job.model_id ?? undefined,
        inputMetadata: (job.input_metadata as Record<string, unknown>) ?? undefined,
        outputMetadata: (job.output_metadata as Record<string, unknown>) ?? undefined,
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
