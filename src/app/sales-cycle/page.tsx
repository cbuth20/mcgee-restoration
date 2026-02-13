"use client";

import { useState, useCallback, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import Card from "@/components/Card";
import DataTable from "@/components/DataTable";
import {
  RefreshCw,
  Users,
  DollarSign,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import {
  loadSalesCycleData,
  SalesCycleState,
  FunnelRow,
  STAGES,
} from "@/lib/salesCycleEngine";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

const milestoneBadgeColors: Record<string, string> = {
  LEAD: "bg-blue-50 text-blue-700",
  PROSPECT: "bg-orange-50 text-orange-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
};

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

export default function SalesCyclePage() {
  const [state, setState] = useState<SalesCycleState | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    await loadSalesCycleData((newState) => {
      setState(newState);
      if (newState.phase === "complete") {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const funnel = state?.funnel || [];
  const conversions = state?.conversions || [];
  const repPerf = state?.repPerformance || [];
  const jobs = state?.jobs || [];

  const totalPipeline = jobs.filter((j) => j.stage !== "Unclassified").length;
  const pipelineValue = jobs
    .filter((j) => j.stage !== "Unclassified")
    .reduce((s, j) => s + j.contractAmount, 0);
  const approvedCount = jobs.filter((j) => j.stage === "Approved").length;
  const fullCycleConversion = conversions.find((c) => c.from === "Lead" && c.to === "Approved");
  const maxFunnelCount = Math.max(...funnel.map((r) => r.count), 1);

  const repColumns = [
    {
      key: "rep",
      label: "Rep",
      sortable: true,
      render: (item: any) => <span className="font-medium text-gray-900">{item.rep}</span>,
    },
    { key: "leads", label: "Leads", sortable: true },
    {
      key: "ivsRate",
      label: "IVS %",
      sortable: true,
      render: (item: any) => <span>{item.ivsRate}%</span>,
    },
    {
      key: "adjusterRate",
      label: "Adjuster %",
      sortable: true,
      render: (item: any) => <span>{item.adjusterRate}%</span>,
    },
    {
      key: "closeRate",
      label: "Close %",
      sortable: true,
      render: (item: any) => (
        <span className={item.closeRate >= 30 ? "font-semibold text-emerald-600" : ""}>
          {item.closeRate}%
        </span>
      ),
    },
    { key: "approvedCount", label: "Approved", sortable: true },
    {
      key: "approvedValue",
      label: "$ Approved",
      sortable: true,
      render: (item: any) => (
        <span className="font-medium">{item.approvedValue > 0 ? fmt(item.approvedValue) : "—"}</span>
      ),
    },
    { key: "avgDays", label: "Avg Days" },
  ];

  return (
    <>
      <PageHeader
        title="Sales Cycle"
        subtitle="Lead → Prospect → Approved pipeline tracker"
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

      {/* Loading progress */}
      {state && state.phase !== "complete" && (
        <ProgressBar progress={state.progress} message={state.phaseMessage} />
      )}

      {/* Error */}
      {state?.error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* KPI Row */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="In Pipeline"
          value={totalPipeline}
          icon={Users}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          label="Pipeline Value"
          value={pipelineValue > 0 ? fmt(pipelineValue) : "—"}
          icon={DollarSign}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          label="Approved"
          value={approvedCount}
          icon={CheckCircle2}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          label="Full Cycle Rate"
          value={fullCycleConversion ? `${fullCycleConversion.rate}%` : "—"}
          icon={TrendingUp}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
        />
      </div>

      {/* Funnel Snapshot */}
      <Card
        title="Funnel Snapshot"
        subtitle={`${STAGES.length} stages across the sales pipeline`}
        className="mb-8"
      >
        <div className="divide-y divide-gray-100">
          {funnel.map((row) => (
            <FunnelBar key={row.stage} row={row} maxCount={maxFunnelCount} />
          ))}
        </div>
      </Card>

      {/* Conversion Rates (MTD) */}
      {conversions.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Conversion Rates (MTD)
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {conversions.map((c) => (
              <ConversionCard key={`${c.from}-${c.to}`} from={c.from} to={c.to} rate={c.rate} />
            ))}
          </div>
        </div>
      )}

      {/* Rep Performance (MTD) */}
      {repPerf.length > 0 && (
        <Card
          title="Rep Performance (MTD)"
          subtitle={`${repPerf.length} sales rep${repPerf.length !== 1 ? "s" : ""} active this month`}
        >
          <DataTable
            columns={repColumns}
            data={repPerf}
            searchable
            searchKeys={["rep"]}
            emptyMessage="No rep data available for this month."
          />
        </Card>
      )}

      {/* Empty state when loading is done but nothing found */}
      {state?.phase === "complete" && !state.error && totalPipeline === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm">
          <p className="text-gray-500">No classified jobs found. Jobs must be in LEAD, PROSPECT, or APPROVED milestones.</p>
        </div>
      )}
    </>
  );
}
