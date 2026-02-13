"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks";
import { getJobs } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import Card from "@/components/Card";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import { RefreshCw, Download, Filter } from "lucide-react";

export default function JobsPage() {
  const { data, loading, error, refetch } = useApi(
    () => getJobs({ maxItems: "250" }),
    []
  );

  const jobList: any[] = data?.items || [];
  const totalCount = data?.count || 0;

  // Milestone filter
  const [milestoneFilter, setMilestoneFilter] = useState<string>("all");
  const milestones = Array.from(
    new Set(jobList.map((j: any) => j.currentMilestone || "Unknown"))
  ).sort();

  const filteredJobs =
    milestoneFilter === "all"
      ? jobList
      : jobList.filter((j: any) => (j.currentMilestone || "Unknown") === milestoneFilter);

  const columns = [
    {
      key: "jobName",
      label: "Job Name",
      sortable: true,
      render: (item: any) => (
        <div>
          <span className="font-medium text-gray-900">
            {item.jobName || `Job #${item.jobNumber || item.id}`}
          </span>
          {item.jobNumber && (
            <p className="text-xs text-gray-500">#{item.jobNumber}</p>
          )}
        </div>
      ),
    },
    {
      key: "currentMilestone",
      label: "Milestone",
      sortable: true,
      render: (item: any) => {
        const name = item.currentMilestone || "—";
        const lc = name.toLowerCase();
        const colors: Record<string, string> = {
          closed: "bg-emerald-50 text-emerald-700",
          cancelled: "bg-red-50 text-red-700",
          lost: "bg-red-50 text-red-700",
        };
        const colorClass = colors[lc] || "bg-blue-50 text-blue-700";
        return (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
            {name}
          </span>
        );
      },
    },
    {
      key: "tradeTypes",
      label: "Trade",
      render: (item: any) =>
        item.tradeTypes?.map((t: any) => t.name).join(", ") || "—",
    },
    {
      key: "workType",
      label: "Work Type",
      render: (item: any) => item.workType?.name || "—",
    },
    {
      key: "leadSource",
      label: "Lead Source",
      sortable: true,
      render: (item: any) => item.leadSource?.name || "—",
    },
    {
      key: "location",
      label: "Location",
      render: (item: any) => {
        const addr = item.locationAddress;
        if (!addr) return "—";
        return [addr.city, addr.state?.abbreviation].filter(Boolean).join(", ");
      },
    },
    {
      key: "createdDate",
      label: "Created",
      sortable: true,
      render: (item: any) =>
        item.createdDate ? new Date(item.createdDate).toLocaleDateString() : "—",
    },
  ];

  const exportCSV = () => {
    const headers = ["Job Name", "Job Number", "Milestone", "Trade", "Work Type", "Lead Source", "City", "State", "Created"];
    const rows = filteredJobs.map((j: any) => [
      j.jobName || "",
      j.jobNumber || "",
      j.currentMilestone || "",
      j.tradeTypes?.map((t: any) => t.name).join("; ") || "",
      j.workType?.name || "",
      j.leadSource?.name || "",
      j.locationAddress?.city || "",
      j.locationAddress?.state?.abbreviation || "",
      j.createdDate || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c: string) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mcgee-jobs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Jobs & Leads"
        subtitle={`${totalCount.toLocaleString()} total jobs in AccuLynx`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              onClick={refetch}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        }
      />

      {loading && <LoadingSpinner message="Loading jobs (fetching pages of 25)..." />}
      {error && !loading && <ErrorMessage message={error} onRetry={refetch} />}

      {!loading && !error && (
        <>
          {/* Summary Stats */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium uppercase text-gray-500">Loaded</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{jobList.length}</p>
            </div>
            {milestones.slice(0, 4).map((m) => (
              <div key={m} className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-xs font-medium uppercase text-gray-500 truncate">{m}</p>
                <p className="mt-1 text-xl font-bold text-gray-900">
                  {jobList.filter((j: any) => (j.currentMilestone || "Unknown") === m).length}
                </p>
              </div>
            ))}
          </div>

          {/* Filter + Table */}
          <Card>
            <div className="mb-4 flex items-center gap-3">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={milestoneFilter}
                onChange={(e) => setMilestoneFilter(e.target.value)}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">All Milestones ({jobList.length})</option>
                {milestones.map((m) => (
                  <option key={m} value={m}>
                    {m} ({jobList.filter((j: any) => (j.currentMilestone || "Unknown") === m).length})
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-500">
                Showing {filteredJobs.length} of {jobList.length} loaded jobs
              </span>
            </div>
            <DataTable
              columns={columns}
              data={filteredJobs}
              searchable
              searchKeys={["jobName", "jobNumber", "id"]}
              emptyMessage="No jobs found"
            />
          </Card>
        </>
      )}
    </>
  );
}
