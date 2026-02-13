"use client";

import { useApi } from "@/lib/hooks";
import { getJobs, getContacts, getUsers } from "@/lib/api";
import StatCard from "@/components/StatCard";
import Card from "@/components/Card";
import PageHeader from "@/components/PageHeader";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import {
  Briefcase,
  Contact,
  Users,
  CheckCircle2,
} from "lucide-react";

export default function DashboardPage() {
  const jobs = useApi(() => getJobs({ maxItems: "200" }), []);
  const contacts = useApi(() => getContacts({ maxItems: "1" }), []);
  const users = useApi(() => getUsers(), []);

  const isLoading = jobs.loading || contacts.loading || users.loading;
  const hasError = jobs.error || contacts.error || users.error;

  const jobList: any[] = jobs.data?.items || [];
  const totalContacts = contacts.data?.count || 0;
  const userList: any[] = users.data?.items || [];
  const totalJobs = jobs.data?.count || jobList.length;

  // Compute stats
  const activeJobs = jobList.filter((j: any) => {
    const m = (j.currentMilestone || "").toLowerCase();
    return m !== "closed" && m !== "cancelled" && m !== "lost";
  });
  const closedJobs = jobList.filter(
    (j: any) => (j.currentMilestone || "").toLowerCase() === "closed"
  );

  // Group jobs by milestone
  const milestoneCounts: Record<string, number> = {};
  jobList.forEach((j: any) => {
    const name = j.currentMilestone || "Unknown";
    milestoneCounts[name] = (milestoneCounts[name] || 0) + 1;
  });

  // Group jobs by trade type
  const tradeCounts: Record<string, number> = {};
  jobList.forEach((j: any) => {
    const trades = j.tradeTypes || [];
    if (trades.length > 0) {
      trades.forEach((t: any) => {
        const name = t.name || "Unknown";
        tradeCounts[name] = (tradeCounts[name] || 0) + 1;
      });
    } else {
      tradeCounts["Unspecified"] = (tradeCounts["Unspecified"] || 0) + 1;
    }
  });

  // Recent jobs
  const recentJobs = [...jobList]
    .sort((a: any, b: any) => {
      const da = new Date(a.createdDate || 0).getTime();
      const db = new Date(b.createdDate || 0).getTime();
      return db - da;
    })
    .slice(0, 10);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your McGee Restoration operations"
      />

      {isLoading && <LoadingSpinner message="Loading dashboard data..." />}

      {hasError && !isLoading && (
        <ErrorMessage
          message={jobs.error || contacts.error || users.error || "Failed to load data"}
          onRetry={() => {
            jobs.refetch();
            contacts.refetch();
            users.refetch();
          }}
        />
      )}

      {!isLoading && !hasError && (
        <>
          {/* Stats Row */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Jobs"
              value={totalJobs.toLocaleString()}
              icon={Briefcase}
              iconColor="text-blue-600"
              iconBg="bg-blue-50"
              change={`${activeJobs.length} active in view`}
              changeType="neutral"
            />
            <StatCard
              label="Contacts"
              value={totalContacts.toLocaleString()}
              icon={Contact}
              iconColor="text-violet-600"
              iconBg="bg-violet-50"
            />
            <StatCard
              label="Team Members"
              value={userList.length}
              icon={Users}
              iconColor="text-emerald-600"
              iconBg="bg-emerald-50"
              change={`${userList.filter((u: any) => u.status === "Active").length} active`}
              changeType="positive"
            />
            <StatCard
              label="Closed Jobs"
              value={closedJobs.length}
              icon={CheckCircle2}
              iconColor="text-amber-600"
              iconBg="bg-amber-50"
              change={
                jobList.length > 0
                  ? `${((closedJobs.length / jobList.length) * 100).toFixed(0)}% of loaded`
                  : undefined
              }
              changeType="positive"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Job Pipeline */}
            <Card title="Job Pipeline" subtitle="Jobs by current milestone">
              <div className="space-y-3">
                {Object.entries(milestoneCounts)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 12)
                  .map(([name, count]) => {
                    const pct = jobList.length > 0 ? (count / jobList.length) * 100 : 0;
                    return (
                      <div key={name} className="flex items-center gap-3">
                        <span className="w-36 truncate text-xs font-medium text-gray-600">
                          {name}
                        </span>
                        <div className="flex-1">
                          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-blue-500 transition-all"
                              style={{ width: `${Math.max(pct, 1)}%` }}
                            />
                          </div>
                        </div>
                        <span className="w-10 text-right text-xs font-semibold text-gray-700">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                {Object.keys(milestoneCounts).length === 0 && (
                  <p className="text-sm text-gray-400">No pipeline data available</p>
                )}
              </div>
            </Card>

            {/* Trade Type Breakdown */}
            <Card title="Trade Type Breakdown" subtitle="Jobs by trade type">
              <div className="space-y-3">
                {Object.entries(tradeCounts)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 12)
                  .map(([name, count]) => {
                    const pct = jobList.length > 0 ? (count / jobList.length) * 100 : 0;
                    return (
                      <div key={name} className="flex items-center gap-3">
                        <span className="w-36 truncate text-xs font-medium text-gray-600">
                          {name}
                        </span>
                        <div className="flex-1">
                          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all"
                              style={{ width: `${Math.max(pct, 1)}%` }}
                            />
                          </div>
                        </div>
                        <span className="w-10 text-right text-xs font-semibold text-gray-700">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                {Object.keys(tradeCounts).length === 0 && (
                  <p className="text-sm text-gray-400">No trade data available</p>
                )}
              </div>
            </Card>

            {/* Recent Jobs */}
            <Card
              title="Recent Jobs"
              subtitle="Latest jobs created"
              className="lg:col-span-2"
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Job Name
                      </th>
                      <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Milestone
                      </th>
                      <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Trade
                      </th>
                      <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Work Type
                      </th>
                      <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Location
                      </th>
                      <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentJobs.map((job: any, i: number) => (
                      <tr key={job.id || i} className="hover:bg-gray-50">
                        <td className="py-2.5 text-sm font-medium text-gray-900">
                          {job.jobName || `Job #${job.jobNumber || job.id}`}
                        </td>
                        <td className="py-2.5">
                          <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {job.currentMilestone || "—"}
                          </span>
                        </td>
                        <td className="py-2.5 text-sm text-gray-600">
                          {job.tradeTypes?.map((t: any) => t.name).join(", ") || "—"}
                        </td>
                        <td className="py-2.5 text-sm text-gray-600">
                          {job.workType?.name || "—"}
                        </td>
                        <td className="py-2.5 text-sm text-gray-500">
                          {[job.locationAddress?.city, job.locationAddress?.state?.abbreviation]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </td>
                        <td className="py-2.5 text-sm text-gray-500">
                          {job.createdDate
                            ? new Date(job.createdDate).toLocaleDateString()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                    {recentJobs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-sm text-gray-400">
                          No recent jobs
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
