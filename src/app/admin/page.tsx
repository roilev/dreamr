"use client";

import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/layout/app-header";
import { Loader2, DollarSign, Zap, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface UsageData {
  summary: {
    totalCost: number;
    totalGenerations: number;
    completedGenerations: number;
    failedGenerations: number;
  };
  byModel: Record<string, { count: number; cost: number; displayName?: string }>;
  byStep: Record<string, { count: number; cost: number }>;
  logs: Array<{
    id: string;
    step: string;
    model_id: string;
    model_display_name?: string;
    status: string;
    cost_usd: number;
    duration_ms: number | null;
    created_at: string;
    error_message: string | null;
  }>;
}

function StatCard({ icon: Icon, label, value, sub }: { icon: typeof DollarSign; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-primary)]/10">
          <Icon size={18} className="text-[var(--accent-primary)]" />
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
          <p className="text-xl font-semibold text-[var(--text-primary)]">{value}</p>
          {sub && <p className="text-xs text-[var(--text-secondary)]">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function ModelBar({ name, displayName, count, cost, maxCost }: { name: string; displayName?: string; count: number; cost: number; maxCost: number }) {
  const pct = maxCost > 0 ? (cost / maxCost) * 100 : 0;
  const shortName = displayName || name;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-secondary)] truncate max-w-[200px]">{shortName}</span>
        <span className="text-[var(--text-muted)]">{count} runs / ${cost.toFixed(2)}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--bg-primary)]">
        <div
          className="h-full rounded-full bg-[var(--text-secondary)]"
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  completed: "text-[var(--success)]",
  failed: "text-[var(--error)]",
  started: "text-[var(--warning)]",
};

export default function AdminPage() {
  const { data, isLoading } = useQuery<UsageData>({
    queryKey: ["admin-usage"],
    queryFn: async () => {
      const res = await fetch("/api/admin/usage?days=30");
      if (!res.ok) throw new Error("Failed to fetch usage");
      return res.json();
    },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8 max-w-6xl mx-auto w-full">
        <Link
          href="/spaces"
          className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Spaces
        </Link>

        <h1 className="text-2xl font-bold mb-6">Usage Dashboard</h1>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-[var(--accent-primary)]" size={24} />
          </div>
        )}

        {data && (
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={DollarSign} label="Est. Spend" value={`$${data.summary.totalCost.toFixed(2)}`} sub="Last 30 days · fal.ai rates" />
              <StatCard icon={Zap} label="Generations" value={String(data.summary.totalGenerations)} />
              <StatCard icon={CheckCircle} label="Completed" value={String(data.summary.completedGenerations)} />
              <StatCard icon={XCircle} label="Failed" value={String(data.summary.failedGenerations)} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
                <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4">Cost by Model</h2>
                <div className="space-y-3">
                  {Object.entries(data.byModel)
                    .sort(([, a], [, b]) => b.cost - a.cost)
                    .map(([name, stats]) => (
                      <ModelBar
                        key={name}
                        name={name}
                        displayName={stats.displayName}
                        count={stats.count}
                        cost={stats.cost}
                        maxCost={Math.max(...Object.values(data.byModel).map((s) => s.cost))}
                      />
                    ))}
                  {Object.keys(data.byModel).length === 0 && (
                    <p className="text-xs text-[var(--text-muted)]">No generations yet</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
                <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4">Cost by Step</h2>
                <div className="space-y-3">
                  {Object.entries(data.byStep)
                    .sort(([, a], [, b]) => b.cost - a.cost)
                    .map(([name, stats]) => (
                      <ModelBar
                        key={name}
                        name={name}
                        count={stats.count}
                        cost={stats.cost}
                        maxCost={Math.max(...Object.values(data.byStep).map((s) => s.cost))}
                      />
                    ))}
                  {Object.keys(data.byStep).length === 0 && (
                    <p className="text-xs text-[var(--text-muted)]">No generations yet</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border-default)]">
                <h2 className="text-sm font-medium text-[var(--text-primary)]">Recent Generations</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-default)] text-xs text-[var(--text-muted)] uppercase tracking-wider">
                      <th className="px-5 py-3 text-left">Time</th>
                      <th className="px-5 py-3 text-left">Step</th>
                      <th className="px-5 py-3 text-left">Model</th>
                      <th className="px-5 py-3 text-left">Status</th>
                      <th className="px-5 py-3 text-right">Cost</th>
                      <th className="px-5 py-3 text-right">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.logs.map((log) => (
                      <tr key={log.id} className="border-b border-[var(--border-default)] last:border-0">
                        <td className="px-5 py-3 text-[var(--text-secondary)]">
                          {new Date(log.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-5 py-3 text-[var(--text-secondary)]">{log.step}</td>
                        <td className="px-5 py-3 text-[var(--text-muted)] truncate max-w-[200px]">{log.model_display_name ?? log.model_id}</td>
                        <td className={`px-5 py-3 capitalize ${STATUS_COLORS[log.status] || "text-[var(--text-muted)]"}`}>
                          {log.status}
                        </td>
                        <td className="px-5 py-3 text-right text-[var(--text-secondary)]">${Number(log.cost_usd).toFixed(4)}</td>
                        <td className="px-5 py-3 text-right text-[var(--text-muted)]">
                          {log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : "—"}
                        </td>
                      </tr>
                    ))}
                    {data.logs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-[var(--text-muted)]">
                          No generations recorded yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
