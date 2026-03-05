import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { estimateJobCost, getModelDisplayName } from "@/lib/utils/model-pricing";

const EMPTY_RESPONSE = {
  summary: { totalCost: 0, totalGenerations: 0, completedGenerations: 0, failedGenerations: 0 },
  byModel: {},
  byStep: {},
  logs: [],
};

interface JobRow {
  id: string;
  step: string;
  status: string;
  model_id: string | null;
  provider: string | null;
  provider_request_id: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createAdminSupabase();
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get("days") || "30", 10);

    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from("pipeline_jobs")
      .select("*")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[admin/usage] Supabase error:", error.message, error.code);
      return NextResponse.json({ ...EMPTY_RESPONSE, _error: error.message });
    }

    const jobs = (data || []) as unknown as JobRow[];
    const byModel: Record<string, { count: number; cost: number; displayName: string }> = {};
    const byStep: Record<string, { count: number; cost: number }> = {};
    let totalCost = 0;

    for (const job of jobs) {
      const cost = estimateJobCost(job);
      totalCost += cost;

      const mKey = job.model_id || "unknown";
      if (!byModel[mKey]) {
        byModel[mKey] = { count: 0, cost: 0, displayName: getModelDisplayName(mKey) };
      }
      byModel[mKey].count++;
      byModel[mKey].cost += cost;

      const sKey = job.step || "unknown";
      if (!byStep[sKey]) byStep[sKey] = { count: 0, cost: 0 };
      byStep[sKey].count++;
      byStep[sKey].cost += cost;
    }

    const logs = jobs.slice(0, 100).map((j) => ({
      id: j.id,
      step: j.step,
      model_id: j.model_id ?? "unknown",
      model_display_name: getModelDisplayName(j.model_id ?? "unknown"),
      status: j.status,
      cost_usd: estimateJobCost(j),
      duration_ms: j.started_at && j.completed_at
        ? new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()
        : null,
      created_at: j.created_at,
      error_message: j.error_message,
    }));

    return NextResponse.json({
      summary: {
        totalCost: Math.round(totalCost * 10000) / 10000,
        totalGenerations: jobs.length,
        completedGenerations: jobs.filter((j) => j.status === "completed").length,
        failedGenerations: jobs.filter((j) => j.status === "failed").length,
      },
      byModel,
      byStep,
      logs,
    });
  } catch (err) {
    console.error("[admin/usage] Unexpected error:", err);
    return NextResponse.json({ ...EMPTY_RESPONSE, _error: err instanceof Error ? err.message : "Internal error" });
  }
}
