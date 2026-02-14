"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import DataTable from "@/components/DataTable";
import {
  RefreshCw,
  Users,
  DollarSign,
  ArrowRight,
  Hammer,
} from "lucide-react";
import {
  loadSalesCycleData,
  SalesCycleState,
  EnrichedJob,
  FunnelRow,
  STAGES,
} from "@/lib/salesCycleEngine";
import { getUsers } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return fmt(n);
};

// ── Shared Components ────────────────────────────────────────────

function ProgressBar({ progress, message }: { progress: number; message: string }) {
  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-gray-600">{message}</span>
        <span className="font-medium text-gray-900">{progress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ── Dashboard Tab Components ─────────────────────────────────────

function GoalCard({
  label,
  actual,
  target,
  format,
  icon: Icon,
  iconColor,
  iconBg,
}: {
  label: string;
  actual: number;
  target: number;
  format: "number" | "currency";
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}) {
  const pct = target > 0 ? Math.min(Math.round((actual / target) * 100), 100) : 0;
  const displayActual = format === "currency" ? fmtCompact(actual) : actual.toLocaleString();
  const displayTarget = format === "currency" ? fmtCompact(target) : target.toLocaleString();

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</span>
          <div className="mt-2 text-3xl font-bold text-gray-900">{displayActual}</div>
          <div className="mt-1 text-sm text-gray-500">of {displayTarget} goal</div>
        </div>
        <div className={`rounded-lg p-2.5 ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-1 text-xs font-medium text-gray-600">{pct}% of goal</div>
        <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              pct >= 75 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-blue-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Sales Cycle Tab Components ───────────────────────────────────

const milestoneBadgeColors: Record<string, string> = {
  LEAD: "bg-blue-50 text-blue-700",
  PROSPECT: "bg-orange-50 text-orange-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
};

function FunnelBar({ row, maxCount }: { row: FunnelRow; maxCount: number }) {
  const pct = maxCount > 0 ? (row.count / maxCount) * 100 : 0;
  const barColors: Record<string, string> = {
    LEAD: "bg-blue-500",
    PROSPECT: "bg-orange-500",
    APPROVED: "bg-emerald-500",
  };

  return (
    <div className="flex items-center gap-4 py-2">
      <div className="w-52 shrink-0">
        <div className="text-sm font-medium text-gray-900">{row.stage}</div>
        <span
          className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            milestoneBadgeColors[row.milestone] || "bg-gray-50 text-gray-600"
          }`}
        >
          {row.milestone}
        </span>
      </div>
      <div className="flex flex-1 items-center gap-3">
        <div className="h-6 flex-1 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              barColors[row.milestone] || "bg-gray-400"
            }`}
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        </div>
        <span className="w-10 text-right text-sm font-bold text-gray-900">{row.count}</span>
        <span className="w-24 text-right text-sm text-gray-500">
          {row.value > 0 ? fmt(row.value) : "—"}
        </span>
      </div>
    </div>
  );
}

function ConversionCard({
  from,
  to,
  rate,
}: {
  from: string;
  to: string;
  rate: number;
}) {
  const color =
    rate >= 60
      ? "text-emerald-600"
      : rate >= 30
      ? "text-amber-600"
      : "text-red-500";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-gray-500">
        <span>{from}</span>
        <ArrowRight className="h-3 w-3" />
        <span>{to}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{rate}%</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            rate >= 60
              ? "bg-emerald-500"
              : rate >= 30
              ? "bg-amber-500"
              : "bg-red-400"
          }`}
          style={{ width: `${rate}%` }}
        />
      </div>
    </div>
  );
}

// ── Helper: compute per-rep milestone counts ─────────────────────

interface RepStageRow {
  rep: string;
  leads: number;
  prospects: number;
  approved: number;
  approvedValue: number;
  total: number;
}

function buildRepStageTable(jobs: EnrichedJob[], salesUserNames: string[]): RepStageRow[] {
  const byRep = new Map<string, EnrichedJob[]>();

  // Seed with all sales users so they appear even with 0 jobs
  for (const name of salesUserNames) {
    byRep.set(name, []);
  }

  for (const job of jobs) {
    if (!job.salesOwner) continue;
    const list = byRep.get(job.salesOwner) || [];
    list.push(job);
    byRep.set(job.salesOwner, list);
  }

  return Array.from(byRep.entries())
    .map(([rep, repJobs]) => {
      const leads = repJobs.filter((j) => j.milestoneCategory === "LEAD").length;
      const prospects = repJobs.filter((j) => j.milestoneCategory === "PROSPECT").length;
      const approvedJobs = repJobs.filter((j) => j.milestoneCategory === "APPROVED");

      return {
        rep,
        leads,
        prospects,
        approved: approvedJobs.length,
        approvedValue: approvedJobs.reduce((s, j) => s + j.contractAmount, 0),
        total: leads + prospects + approvedJobs.length,
      };
    })
    .sort((a, b) => b.total - a.total || a.rep.localeCompare(b.rep));
}

// ── Main Page ────────────────────────────────────────────────────

export default function SalesCyclePage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "sales-cycle">("dashboard");
  const [state, setState] = useState<SalesCycleState | null>(null);
  const [loading, setLoading] = useState(false);
  const [salesUsers, setSalesUsers] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);

    // Fetch sales users in parallel with job data
    const usersPromise = getUsers()
      .then((res: any) => {
        const users = res.items || res || [];
        const salesNames: string[] = users
          .filter((u: any) => {
            const role = u.role?.name || u.roleName || "";
            return role === "Sales";
          })
          .map((u: any) =>
            u.displayName ||
            [u.firstName, u.lastName].filter(Boolean).join(" ") ||
            u.name
          )
          .filter(Boolean);
        setSalesUsers(salesNames);
      })
      .catch(() => {
        // Table will still show reps discovered from job data
      });

    const dataPromise = loadSalesCycleData((newState) => {
      setState(newState);
      if (newState.phase === "complete") {
        setLoading(false);
      }
    });

    await Promise.all([usersPromise, dataPromise]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const jobs = state?.jobs || [];
  const funnel = state?.funnel || [];
  const conversions = state?.conversions || [];

  // ── DEBUG: test API endpoints ──
  useEffect(() => {
    if (state?.phase !== "complete" || jobs.length === 0) return;

    // Find an APPROVED job to test financials on
    const approvedJob = jobs.find((j) => j.milestoneCategory === "APPROVED");
    if (approvedJob) {
      console.log("=== DEBUG: Testing financials for APPROVED job:", approvedJob.id, approvedJob.jobName, "===");

      // Test: /jobs/{id}/financials
      fetch(`/api/acculynx?endpoint=${encodeURIComponent(`/jobs/${approvedJob.id}/financials`)}`)
        .then((r) => r.json())
        .then((data) => console.log("=== DEBUG: /financials response ===", JSON.stringify(data, null, 2)))
        .catch((err) => console.error("=== DEBUG: /financials ERROR ===", err));

      // Test: /jobs/{id}/estimates
      fetch(`/api/acculynx?endpoint=${encodeURIComponent(`/jobs/${approvedJob.id}/estimates`)}`)
        .then((r) => r.json())
        .then((data) => console.log("=== DEBUG: /estimates response ===", JSON.stringify(data, null, 2)))
        .catch((err) => console.error("=== DEBUG: /estimates ERROR ===", err));

      // Test: /jobs/{id} (full job object)
      fetch(`/api/acculynx?endpoint=${encodeURIComponent(`/jobs/${approvedJob.id}`)}`)
        .then((r) => r.json())
        .then((data) => console.log("=== DEBUG: /jobs/{id} full ===", JSON.stringify(data, null, 2)))
        .catch((err) => console.error("=== DEBUG: /jobs/{id} ERROR ===", err));
    }

    // Summary: salesOwner + contractAmount stats
    const jobOwners = [...new Set(jobs.filter((j) => j.salesOwner).map((j) => j.salesOwner))].sort();
    const withAmount = jobs.filter((j) => j.contractAmount > 0);
    console.log("=== DEBUG: salesOwner populated on", jobOwners.length, "of", jobs.length, "jobs ===", jobOwners);
    console.log("=== DEBUG: contractAmount > 0 on", withAmount.length, "jobs. Sample:", withAmount.slice(0, 5).map((j) => ({ name: j.jobName, amount: j.contractAmount, milestone: j.milestoneCategory })));
  }, [state?.phase, jobs]);
  // ── END DEBUG ──

  // YTD goal calculations
  const prospectCount = jobs.filter((j) => j.milestoneCategory === "PROSPECT").length;
  const approvedJobs = jobs.filter((j) => j.milestoneCategory === "APPROVED");
  const approvedTotal = approvedJobs.reduce((s, j) => s + j.contractAmount, 0);

  // Rep stage table
  const repStageData = useMemo(
    () => buildRepStageTable(jobs, salesUsers),
    [jobs, salesUsers]
  );

  const maxFunnelCount = Math.max(...funnel.map((r) => r.count), 1);

  const repColumns = [
    {
      key: "rep",
      label: "Rep",
      sortable: true,
      render: (item: RepStageRow) => (
        <span className="font-medium text-gray-900">{item.rep}</span>
      ),
    },
    { key: "leads", label: "Leads", sortable: true },
    { key: "prospects", label: "Prospects", sortable: true },
    { key: "approved", label: "Approved", sortable: true },
    {
      key: "approvedValue",
      label: "$ Approved",
      sortable: true,
      render: (item: RepStageRow) => (
        <span className="font-medium">
          {item.approvedValue > 0 ? fmt(item.approvedValue) : "—"}
        </span>
      ),
    },
    {
      key: "total",
      label: "Total",
      sortable: true,
      render: (item: RepStageRow) => (
        <span className="font-semibold text-gray-900">{item.total}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Sales Dashboard"
        subtitle="AMRG year-to-date sales performance"
        actions={
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
              activeTab === "dashboard"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("sales-cycle")}
            className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
              activeTab === "sales-cycle"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            Sales Cycle
          </button>
        </nav>
      </div>

      {/* Error */}
      {state?.error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* Loading state — show until all data is ready */}
      {(!state || state.phase !== "complete") && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-20 shadow-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-gray-200 border-t-blue-600" />
          <p className="mt-4 text-sm font-medium text-gray-700">
            {state?.phaseMessage || "Connecting to AccuLynx..."}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Processing data, may take a couple minutes...
          </p>
          {state && (
            <div className="mt-4 w-64">
              <div className="mb-1 text-right text-xs text-gray-400">{state.progress}%</div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ Content — only rendered after loading completes ═══ */}
      {state?.phase === "complete" && !state.error && (
        <>
          {/* ═══ Dashboard Tab ═══ */}
          {activeTab === "dashboard" && (
            <>
              {/* YTD Goals Row */}
              <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <GoalCard
                  label="Prospects YTD"
                  actual={prospectCount}
                  target={2000}
                  format="number"
                  icon={Users}
                  iconColor="text-orange-600"
                  iconBg="bg-orange-50"
                />
                <GoalCard
                  label="Sales YTD"
                  actual={approvedTotal}
                  target={30_000_000}
                  format="currency"
                  icon={DollarSign}
                  iconColor="text-emerald-600"
                  iconBg="bg-emerald-50"
                />
                <GoalCard
                  label="Built YTD"
                  actual={approvedTotal}
                  target={27_500_000}
                  format="currency"
                  icon={Hammer}
                  iconColor="text-blue-600"
                  iconBg="bg-blue-50"
                />
              </div>

              {/* Sales Rep Table */}
              <Card
                title="Sales Rep Performance"
                subtitle={`${repStageData.length} rep${repStageData.length !== 1 ? "s" : ""} — jobs by pipeline stage`}
              >
                <DataTable
                  columns={repColumns}
                  data={repStageData}
                  searchable
                  searchKeys={["rep"]}
                  emptyMessage="No sales rep data available."
                />
              </Card>
            </>
          )}

          {/* ═══ Sales Cycle Tab ═══ */}
          {activeTab === "sales-cycle" && (
        <>
          {/* Conversion Rates */}
          {conversions.length > 0 && (
            <div className="mb-8">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
                Conversion Rates
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {conversions.map((c) => (
                  <ConversionCard key={`${c.from}-${c.to}`} from={c.from} to={c.to} rate={c.rate} />
                ))}
              </div>
            </div>
          )}

          {/* Funnel Snapshot */}
          <Card
            title="Funnel Snapshot"
            subtitle={`${STAGES.length} stages across the sales pipeline`}
          >
            <div className="divide-y divide-gray-100">
              {funnel.map((row) => (
                <FunnelBar key={row.stage} row={row} maxCount={maxFunnelCount} />
              ))}
            </div>
          </Card>
        </>
      )}

          {/* Empty state */}
          {jobs.filter((j) => j.stage !== "Unclassified").length === 0 && (
            <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm">
              <p className="text-gray-500">
                No classified jobs found. Jobs must be in LEAD, PROSPECT, or APPROVED milestones.
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}
