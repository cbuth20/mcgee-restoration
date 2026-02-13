"use client";

import { useState, useMemo } from "react";
import { useApi } from "@/lib/hooks";
import { getJobs, getContacts, getUsers } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import DataTable from "@/components/DataTable";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import { RefreshCw, Download } from "lucide-react";

type ReportType = "pipeline" | "lead-sources" | "work-type" | "job-aging" | "geography" | "rep-performance";

const reportDefinitions: { key: ReportType; label: string; description: string }[] = [
  { key: "pipeline", label: "Pipeline Report", description: "Jobs grouped by milestone stage" },
  { key: "lead-sources", label: "Lead Sources", description: "Jobs by lead source origin" },
  { key: "work-type", label: "Work Types", description: "Insurance vs retail vs other" },
  { key: "job-aging", label: "Job Aging", description: "Jobs by age since creation" },
  { key: "geography", label: "Geography", description: "Jobs by city/state" },
  { key: "rep-performance", label: "User Roles", description: "Team distribution by role" },
];

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>("pipeline");

  const { data: jobsData, loading: jobsLoading, error: jobsError, refetch: refetchJobs } = useApi(
    () => getJobs({ maxItems: "250" }),
    []
  );
  const { data: contactsData, loading: contactsLoading } = useApi(
    () => getContacts({ maxItems: "1" }),
    []
  );
  const { data: usersData, loading: usersLoading } = useApi(
    () => getUsers(),
    []
  );

  const jobList: any[] = jobsData?.items || [];
  const totalContacts = contactsData?.count || 0;
  const userList: any[] = usersData?.items || [];

  const isLoading = jobsLoading || contactsLoading || usersLoading;

  // Pipeline Report
  const pipelineData = useMemo(() => {
    const groups: Record<string, number> = {};
    jobList.forEach((j: any) => {
      const milestone = j.currentMilestone || "Unknown";
      groups[milestone] = (groups[milestone] || 0) + 1;
    });
    return Object.entries(groups)
      .map(([milestone, count]) => ({
        milestone,
        count,
        percentage: jobList.length > 0 ? ((count / jobList.length) * 100).toFixed(1) : "0",
      }))
      .sort((a, b) => b.count - a.count);
  }, [jobList]);

  // Lead Source Analysis
  const leadSourceData = useMemo(() => {
    const groups: Record<string, number> = {};
    jobList.forEach((j: any) => {
      const source = j.leadSource?.name || "Unknown";
      groups[source] = (groups[source] || 0) + 1;
    });
    return Object.entries(groups)
      .map(([source, count]) => ({
        source,
        count,
        percentage: jobList.length > 0 ? ((count / jobList.length) * 100).toFixed(1) : "0",
      }))
      .sort((a, b) => b.count - a.count);
  }, [jobList]);

  // Work Type
  const workTypeData = useMemo(() => {
    const groups: Record<string, number> = {};
    jobList.forEach((j: any) => {
      const wt = j.workType?.name || "Unknown";
      groups[wt] = (groups[wt] || 0) + 1;
    });
    return Object.entries(groups)
      .map(([workType, count]) => ({
        workType,
        count,
        percentage: jobList.length > 0 ? ((count / jobList.length) * 100).toFixed(1) : "0",
      }))
      .sort((a, b) => b.count - a.count);
  }, [jobList]);

  // Job Aging
  const jobAgingData = useMemo(() => {
    const now = Date.now();
    const buckets: Record<string, number> = {
      "0-30 days": 0,
      "31-60 days": 0,
      "61-90 days": 0,
      "91-180 days": 0,
      "181-365 days": 0,
      "1+ year": 0,
    };
    jobList.forEach((j: any) => {
      const created = new Date(j.createdDate || now).getTime();
      const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
      if (days <= 30) buckets["0-30 days"]++;
      else if (days <= 60) buckets["31-60 days"]++;
      else if (days <= 90) buckets["61-90 days"]++;
      else if (days <= 180) buckets["91-180 days"]++;
      else if (days <= 365) buckets["181-365 days"]++;
      else buckets["1+ year"]++;
    });
    return Object.entries(buckets).map(([range, count]) => ({
      range,
      count,
      percentage: jobList.length > 0 ? ((count / jobList.length) * 100).toFixed(1) : "0",
    }));
  }, [jobList]);

  // Geography
  const geoData = useMemo(() => {
    const groups: Record<string, number> = {};
    jobList.forEach((j: any) => {
      const city = j.locationAddress?.city;
      const state = j.locationAddress?.state?.abbreviation;
      const key = city && state ? `${city}, ${state}` : state || "Unknown";
      groups[key] = (groups[key] || 0) + 1;
    });
    return Object.entries(groups)
      .map(([location, count]) => ({
        location,
        count,
        percentage: jobList.length > 0 ? ((count / jobList.length) * 100).toFixed(1) : "0",
      }))
      .sort((a, b) => b.count - a.count);
  }, [jobList]);

  // User Roles
  const roleData = useMemo(() => {
    const groups: Record<string, number> = {};
    userList.forEach((u: any) => {
      const role = u.role?.name || "Unknown";
      groups[role] = (groups[role] || 0) + 1;
    });
    return Object.entries(groups)
      .map(([role, count]) => ({
        role,
        count,
        percentage: userList.length > 0 ? ((count / userList.length) * 100).toFixed(1) : "0",
      }))
      .sort((a, b) => b.count - a.count);
  }, [userList]);

  const exportCurrentReport = () => {
    let headers: string[] = [];
    let rows: string[][] = [];

    switch (activeReport) {
      case "pipeline":
        headers = ["Milestone", "Count", "Percentage"];
        rows = pipelineData.map((r) => [r.milestone, String(r.count), `${r.percentage}%`]);
        break;
      case "lead-sources":
        headers = ["Source", "Count", "Percentage"];
        rows = leadSourceData.map((r) => [r.source, String(r.count), `${r.percentage}%`]);
        break;
      case "work-type":
        headers = ["Work Type", "Count", "Percentage"];
        rows = workTypeData.map((r) => [r.workType, String(r.count), `${r.percentage}%`]);
        break;
      case "job-aging":
        headers = ["Age Range", "Count", "Percentage"];
        rows = jobAgingData.map((r) => [r.range, String(r.count), `${r.percentage}%`]);
        break;
      case "geography":
        headers = ["Location", "Count", "Percentage"];
        rows = geoData.map((r) => [r.location, String(r.count), `${r.percentage}%`]);
        break;
      case "rep-performance":
        headers = ["Role", "Count", "Percentage"];
        rows = roleData.map((r) => [r.role, String(r.count), `${r.percentage}%`]);
        break;
    }

    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mcgee-${activeReport}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderBarChart = (
    data: { label: string; count: number; percentage: string }[],
    color: string
  ) => (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.label} className="flex items-center gap-4">
          <span className="w-44 truncate text-sm font-medium text-gray-700">{item.label}</span>
          <div className="flex-1">
            <div className="h-7 w-full overflow-hidden rounded-lg bg-gray-100">
              <div
                className={`flex h-full items-center rounded-lg ${color} px-2 text-xs font-medium text-white transition-all`}
                style={{ width: `${Math.max(Number(item.percentage), 2)}%` }}
              >
                {Number(item.percentage) > 6 && `${item.percentage}%`}
              </div>
            </div>
          </div>
          <span className="w-12 text-right text-sm font-bold text-gray-900">{item.count}</span>
        </div>
      ))}
    </div>
  );

  const renderReport = () => {
    switch (activeReport) {
      case "pipeline":
        return (
          <Card title="Pipeline Report" subtitle={`${jobList.length} jobs across ${pipelineData.length} milestones`}>
            {renderBarChart(
              pipelineData.map((d) => ({ label: d.milestone, count: d.count, percentage: d.percentage })),
              "bg-blue-500"
            )}
          </Card>
        );
      case "lead-sources":
        return (
          <Card title="Lead Source Analysis" subtitle="Where your jobs are coming from">
            {renderBarChart(
              leadSourceData.map((d) => ({ label: d.source, count: d.count, percentage: d.percentage })),
              "bg-violet-500"
            )}
          </Card>
        );
      case "work-type":
        return (
          <Card title="Work Type Breakdown" subtitle="Insurance vs retail and more">
            {renderBarChart(
              workTypeData.map((d) => ({ label: d.workType, count: d.count, percentage: d.percentage })),
              "bg-emerald-500"
            )}
          </Card>
        );
      case "job-aging":
        return (
          <Card title="Job Aging Report" subtitle="Jobs by age since creation">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {jobAgingData.map((item) => (
                <div key={item.range} className="rounded-xl border border-gray-200 p-5 text-center">
                  <p className="text-3xl font-bold text-gray-900">{item.count}</p>
                  <p className="mt-1 text-sm font-medium text-gray-600">{item.range}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{item.percentage}% of total</p>
                </div>
              ))}
            </div>
          </Card>
        );
      case "geography":
        return (
          <Card title="Geographic Distribution" subtitle={`Jobs across ${geoData.length} locations`}>
            <DataTable
              columns={[
                { key: "location", label: "Location", sortable: true, render: (item: any) => <span className="font-medium">{item.location}</span> },
                { key: "count", label: "Jobs", sortable: true },
                {
                  key: "percentage",
                  label: "Share",
                  sortable: true,
                  render: (item: any) => (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${item.percentage}%` }} />
                      </div>
                      <span className="text-sm">{item.percentage}%</span>
                    </div>
                  ),
                },
              ]}
              data={geoData}
              searchable
              searchKeys={["location"]}
              emptyMessage="No geographic data"
            />
          </Card>
        );
      case "rep-performance":
        return (
          <Card title="Team Role Distribution" subtitle={`${userList.length} team members`}>
            {renderBarChart(
              roleData.map((d) => ({ label: d.role, count: d.count, percentage: d.percentage })),
              "bg-amber-500"
            )}
          </Card>
        );
    }
  };

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Customizable reports powered by AccuLynx data"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={exportCurrentReport}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              onClick={refetchJobs}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        }
      />

      {/* Report Selector */}
      <div className="mb-6 flex flex-wrap gap-2">
        {reportDefinitions.map((report) => (
          <button
            key={report.key}
            onClick={() => setActiveReport(report.key)}
            className={`flex flex-col items-start rounded-lg border px-4 py-3 text-left transition-all ${
              activeReport === report.key
                ? "border-blue-200 bg-blue-50 shadow-sm"
                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <span className={`text-sm font-semibold ${activeReport === report.key ? "text-blue-700" : "text-gray-700"}`}>
              {report.label}
            </span>
            <span className={`text-xs ${activeReport === report.key ? "text-blue-500" : "text-gray-400"}`}>
              {report.description}
            </span>
          </button>
        ))}
      </div>

      {isLoading && <LoadingSpinner message="Loading report data..." />}
      {jobsError && !isLoading && <ErrorMessage message={jobsError} onRetry={refetchJobs} />}
      {!isLoading && !jobsError && renderReport()}
    </>
  );
}
